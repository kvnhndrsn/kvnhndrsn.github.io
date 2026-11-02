---
layout: default
title: Games
---

<style>
    .game-shell {
        margin: 1.5rem 0 1rem;
    }

    #game-mount {
        position: relative;
        width: 100%;
        max-width: 960px;
        aspect-ratio: 8 / 5;
        margin: 0 auto;
        border: 1px solid #2a3040;
        background: #07070a;
        overflow: hidden;
        touch-action: none;
    }

    #game-mount canvas {
        display: block;
    }

    .game-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem 1.6rem;
        margin: 1rem 0 0;
        font-size: 0.8rem;
        color: #9fb4bd;
        letter-spacing: 0.04em;
    }

    .game-legend span {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
    }

    .game-swatch {
        width: 14px;
        height: 14px;
        display: inline-block;
        border: 2px solid #fff;
    }

    .game-swatch.tri {
        border-color: #baffdf;
        background: #35d99a;
        clip-path: polygon(50% 0, 100% 100%, 0 100%);
    }

    .game-swatch.you {
        border-color: #e8fbff;
        background: #7fe7ff;
        clip-path: polygon(50% 0, 100% 100%, 0 100%);
    }

    .game-swatch.sq {
        border-color: #6b1e25;
        background: #ff5566;
    }

    .game-swatch.dot {
        border-color: #6b3c0a;
        background: #ffa03d;
        border-radius: 50%;
    }
</style>

<h1>Triangles</h1>

<p>
    You are the bright triangle. Your team is the green ones. Squares and circles
    are not on your team. Nobody has a gun; the sword only hits in the direction
    you are walking, so keep moving and keep the crowd in front of you.
</p>

<div class="game-shell">
    <div id="game-mount"></div>
</div>

<div class="game-legend">
    <span><i class="game-swatch you"></i> you</span>
    <span><i class="game-swatch tri"></i> your team</span>
    <span><i class="game-swatch sq"></i> squares</span>
    <span><i class="game-swatch dot"></i> circles</span>
</div>

<p style="font-size:0.85rem;color:#9fb4bd;">
    <strong>Controls:</strong> WASD or arrow keys to move. Your sword swings
    automatically in the direction you are walking. <strong>Space</strong> swings
    on demand. <strong>R</strong> restarts after you die. Keyboard only, sorry.
</p>

<script src="https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js"></script>
<script src="/games/game.js"></script>
