// Everything the player sees: sky, projected valley terrain, river, runway,
// trees, glowing rings, the aircraft, the cockpit, the HUD and the screens.
// One clear job: turn a world state and a camera into one canvas frame.

import { COLORS, RING, WORLD } from './config.js';
import { isRiverWater, isRunwayGround, riverCentreX, terrainHeightAt } from './terrain.js';
import { nextRing, PHASE_FLYING, PHASE_OVER, PHASE_TITLE, visibleRings } from './world.js';

/** Chase camera: just behind and above the plane, looking along its heading. */
export function chaseCamera(world) {
  const plane = world.plane;
  return {
    x: plane.x - Math.sin(plane.heading) * 17,
    y: plane.y + 5.5,
    z: plane.z - Math.cos(plane.heading) * 17,
    heading: plane.heading,
  };
}

/** Cockpit camera: at the pilot's eyes, looking straight out the windscreen. */
export function cockpitCamera(world) {
  const plane = world.plane;
  return { x: plane.x, y: plane.y + 1.2, z: plane.z, heading: plane.heading };
}

function horizonY(height) {
  return height * WORLD.horizonFraction;
}

function focalLength(height) {
  return height * WORLD.focal;
}

/**
 * Project a world point into screen space from a camera.
 * Returns { x, y, depth, scale } or null when the point is behind the camera.
 */
export function projectPoint(camera, wx, wy, wz, width, height) {
  const dx = wx - camera.x;
  const dz = wz - camera.z;
  const sinH = Math.sin(camera.heading);
  const cosH = Math.cos(camera.heading);
  const depth = dx * sinH + dz * cosH;
  if (depth < 1.5) return null;
  const across = dx * cosH - dz * sinH;
  const scale = focalLength(height) / depth;
  return {
    x: width / 2 + across * scale,
    y: horizonY(height) - (wy - camera.y) * scale,
    depth,
    scale,
  };
}

/** Blend two hex colours by t (0..1). */
function blendHex(low, high, t) {
  const parse = (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const a = parse(low);
  const b = parse(high);
  const mixed = a.map((value, index) => Math.round(value + (b[index] - value) * t));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function groundColorAt(wx, wz, height, depth) {
  let base;
  if (isRiverWater(wx, wz)) base = height < 0 ? COLORS.riverDeep : COLORS.river;
  else if (isRunwayGround(wx, wz)) {
    base = Math.abs(wx + 40) < 1.4 && Math.floor(wz / 26) % 2 === 0 ? COLORS.runwayLine : COLORS.runway;
  } else if (height > 105) base = COLORS.snow;
  else if (height > 95) base = blendHex(COLORS.rock, COLORS.snow, (height - 95) / 10);
  else if (height > 45) base = COLORS.rock;
  else if (height > 38) base = blendHex(COLORS.grassHigh, COLORS.rock, (height - 38) / 7);
  else if (height > 12) base = COLORS.grassHigh;
  else if (height > 4) base = blendHex(COLORS.grassLow, COLORS.grassHigh, (height - 4) / 8);
  else base = COLORS.grassLow;
  const haze = Math.min(0.7, depth / WORLD.farDepth);
  return { base, haze };
}

function drawSky(ctx, width, height, camera) {
  const horizon = horizonY(height);
  const gradient = ctx.createLinearGradient(0, 0, 0, horizon);
  gradient.addColorStop(0, COLORS.skyTop);
  gradient.addColorStop(0.62, COLORS.skyMid);
  gradient.addColorStop(1, COLORS.skyHorizon);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, horizon + 2);
  // Sun, placed by the camera heading so it stays put as the pilot turns.
  const sunX = width / 2 - Math.sin(camera.heading) * width * 0.28 + width * 0.3;
  const sunY = height * 0.12;
  ctx.fillStyle = COLORS.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 243, 196, 0.25)';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 44, 0, Math.PI * 2);
  ctx.fill();
  // A few flat clouds drifting over the valley.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (let index = 0; index < 6; index += 1) {
    const cx = ((index * 331 + 140) % 1200) / 1200 * width;
    const cy = height * (0.08 + (index % 3) * 0.07);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 70, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 44, cy + 5, 46, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Base fill below the horizon so no gap ever shows between sky and terrain.
  ctx.fillStyle = COLORS.grassLow;
  ctx.fillRect(0, horizon, width, height - horizon);
}

/** The valley floor, ridges, river and runway, drawn far-to-near in depth slices. */
function drawTerrainSlices(ctx, camera, width, height) {
  const horizon = horizonY(height);
  const focal = focalLength(height);
  const sinH = Math.sin(camera.heading);
  const cosH = Math.cos(camera.heading);
  const step = 6;
  const columns = Math.ceil(width / step);
  const depths = [];
  for (let depth = WORLD.farDepth; depth > 9; depth *= 0.95) depths.push(depth);
  let previousRow = null;
  for (const depth of depths) {
    const scale = focal / depth;
    const row = new Float32Array(columns + 1);
    const rowColor = new Array(columns + 1);
    for (let column = 0; column <= columns; column += 1) {
      const sx = column * step;
      const across = (sx - width / 2) / scale;
      const wx = camera.x + across * cosH + depth * sinH;
      const wz = camera.z - across * sinH + depth * cosH;
      const ground = terrainHeightAt(wx, wz);
      row[column] = horizon - (ground - camera.y) * scale;
      rowColor[column] = groundColorAt(wx, wz, ground, depth);
    }
    if (previousRow !== null) {
      for (let column = 0; column < columns; column += 1) {
        const top = Math.min(row[column], previousRow[column]);
        const bottom = Math.max(row[column], previousRow[column]);
        if (bottom - top < 0.5) continue;
        const { base, haze } = rowColor[column];
        ctx.globalAlpha = 1;
        ctx.fillStyle = base;
        ctx.fillRect(column * step, top, step + 1, bottom - top + 1);
        if (haze > 0.02) {
          ctx.globalAlpha = haze * 0.55;
          ctx.fillStyle = COLORS.skyHorizon;
          ctx.fillRect(column * step, top, step + 1, bottom - top + 1);
        }
      }
    }
    ctx.globalAlpha = 1;
    previousRow = row;
  }
}

/** The river as one smooth ribbon following its channel down the valley. */
function drawRiverRibbon(ctx, camera, width, height) {
  const leftBank = [];
  const rightBank = [];
  for (let z = camera.z + 15; z < camera.z + WORLD.farDepth; z += 22) {
    const centre = riverCentreX(z);
    const ground = terrainHeightAt(centre, z) + 0.6;
    const left = projectPoint(camera, centre - 9, ground, z, width, height);
    const right = projectPoint(camera, centre + 9, ground, z, width, height);
    if (left === null || right === null) continue;
    leftBank.push(left);
    rightBank.push(right);
  }
  if (leftBank.length < 2) return;
  ctx.fillStyle = COLORS.river;
  ctx.beginPath();
  ctx.moveTo(leftBank[0].x, leftBank[0].y);
  for (const point of leftBank) ctx.lineTo(point.x, point.y);
  for (let index = rightBank.length - 1; index >= 0; index -= 1) {
    ctx.lineTo(rightBank[index].x, rightBank[index].y);
  }
  ctx.closePath();
  ctx.fill();
}

/** Trees as depth-scaled triangles standing on the terrain. */
function drawTrees(ctx, camera, world, width, height) {
  for (const tree of world.trees) {
    const point = projectPoint(camera, tree.x, tree.y, tree.z, width, height);
    if (point === null || point.depth > WORLD.farDepth) continue;
    if (point.x < -20 || point.x > width + 20 || point.y < -20 || point.y > height + 20) continue;
    const size = Math.max(2, tree.size * point.scale * 0.9);
    const haze = Math.min(0.6, point.depth / WORLD.farDepth);
    ctx.globalAlpha = 1 - haze * 0.5;
    ctx.fillStyle = tree.size > 9 ? COLORS.treeLight : COLORS.tree;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y - size);
    ctx.lineTo(point.x - size * 0.55, point.y);
    ctx.lineTo(point.x + size * 0.55, point.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** The glowing target rings ahead, with a guide line down to the ground. */
function drawRings(ctx, camera, world, width, height) {
  for (const ring of visibleRings(world, 5)) {
    const centre = projectPoint(camera, ring.x, ring.y, ring.z, width, height);
    if (centre === null) continue;
    const radius = ring.radius * centre.scale;
    if (radius < 2 || radius > width * 1.4) continue;
    const ground = projectPoint(camera, ring.x, terrainHeightAt(ring.x, ring.z), ring.z, width, height);
    if (ground !== null) {
      ctx.strokeStyle = 'rgba(255, 210, 63, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centre.x, centre.y);
      ctx.lineTo(ground.x, ground.y);
      ctx.stroke();
    }
    ctx.save();
    ctx.shadowColor = COLORS.ring;
    ctx.shadowBlur = RING.glow;
    ctx.strokeStyle = COLORS.ring;
    ctx.lineWidth = Math.max(2, radius * 0.14);
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = COLORS.ringCore;
    ctx.lineWidth = Math.max(1, radius * 0.05);
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // Ring number: above small rings, inside the top of big ones so it never
    // collides with the NEXT RING line at the top of the screen.
    ctx.fillStyle = COLORS.hudAmber;
    ctx.textAlign = 'center';
    if (radius > 90) {
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(String(ring.index + 1), centre.x, centre.y - radius + 36);
    } else if (radius > 14) {
      ctx.font = `bold ${Math.max(12, radius * 0.42)}px sans-serif`;
      ctx.fillText(String(ring.index + 1), centre.x, centre.y - radius - 8);
    }
  }
}

/** The player's prop plane, drawn in chase view with its bank showing. */
function drawChasePlane(ctx, world, width, height) {
  const plane = world.plane;
  const camera = chaseCamera(world);
  const point = projectPoint(camera, plane.x, plane.y, plane.z, width, height);
  if (point === null) return;
  const size = Math.max(46, 1500 / point.depth);
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(plane.roll * 0.9);
  ctx.scale(size / 100, size / 100);
  // Prop blur disc.
  ctx.fillStyle = 'rgba(220, 230, 240, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, -52, 16, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wings.
  ctx.fillStyle = '#c23b2e';
  ctx.beginPath();
  ctx.roundRect(-52, -8, 104, 15, 7);
  ctx.fill();
  ctx.fillStyle = '#e8e4da';
  ctx.beginPath();
  ctx.roundRect(-52, -8, 104, 5, 3);
  ctx.fill();
  // Tail.
  ctx.fillStyle = '#8f2a20';
  ctx.beginPath();
  ctx.roundRect(-20, 34, 40, 9, 4);
  ctx.fill();
  // Fuselage.
  ctx.fillStyle = '#f2ede2';
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c23b2e';
  ctx.beginPath();
  ctx.ellipse(0, 18, 13, 16, 0, 0, Math.PI);
  ctx.fill();
  // Canopy.
  ctx.fillStyle = '#274b63';
  ctx.beginPath();
  ctx.ellipse(0, -18, 8, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Cockpit dashboard: lit gauges across the bottom of the windscreen. */
function drawCockpit(ctx, world, width, height) {
  const panelHeight = height * 0.24;
  const panelTop = height - panelHeight;
  const gradient = ctx.createLinearGradient(0, panelTop, 0, height);
  gradient.addColorStop(0, '#1c2733');
  gradient.addColorStop(1, '#0a1017');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(0, panelTop, width, panelHeight + 4, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(234, 246, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  const plane = world.plane;
  const gauges = [
    { label: 'ALT', value: Math.round(plane.y * 32), max: 8000, unit: 'FT' },
    { label: 'SPD', value: Math.round(plane.speed * 2.1), max: 220, unit: 'KT' },
    { label: 'FUEL', value: Math.round(world.fuel), max: 100, unit: '%' },
  ];
  const gaugeRadius = Math.min(52, panelHeight * 0.34);
  const gap = width / 4;
  gauges.forEach((gauge, index) => {
    const cx = gap * (index + 1);
    const cy = panelTop + panelHeight * 0.46;
    ctx.fillStyle = '#0d1620';
    ctx.beginPath();
    ctx.arc(cx, cy, gaugeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.hudAmber;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, gaugeRadius, 0, Math.PI * 2);
    ctx.stroke();
    const angle = -Math.PI * 0.75 + (Math.PI * 1.5 * gauge.value) / gauge.max;
    ctx.strokeStyle = COLORS.hudGreen;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * (gaugeRadius - 6) * 0.55, cy + Math.sin(angle) * (gaugeRadius - 6) * 0.55);
    ctx.stroke();
    ctx.fillStyle = COLORS.hudText;
    ctx.font = `bold ${Math.max(15, gaugeRadius * 0.42)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(String(gauge.value), cx, cy + gaugeRadius * 0.62);
    ctx.font = `bold 13px sans-serif`;
    ctx.fillStyle = COLORS.hudAmber;
    ctx.fillText(`${gauge.label} ${gauge.unit}`, cx, cy + gaugeRadius + 18);
  });
  // Nose cone peeking over the panel.
  ctx.fillStyle = '#c23b2e';
  ctx.beginPath();
  ctx.ellipse(width / 2, height + 6, 60, 26, 0, Math.PI, 0);
  ctx.fill();
}

/** Shared helpers for the HUD panels. */
function hudPanel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(234, 246, 255, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function hudReadout(ctx, x, y, label, value, accent) {
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.hudAmber;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(label, x, y);
  ctx.fillStyle = accent || COLORS.hudText;
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(value, x, y + 26);
}

/** The always-on HUD: altitude, speed, heading, score, rings, fuel and time. */
function drawHud(ctx, world, width, height, view) {
  const plane = world.plane;
  const headingDegrees = ((Math.round((-plane.heading * 180) / Math.PI) % 360) + 360) % 360;
  const pad = 14;
  // Left: altitude, speed, heading.
  hudPanel(ctx, pad, pad, 300, 64);
  hudReadout(ctx, pad + 12, pad + 20, 'ALTITUDE', `${Math.round(plane.y * 32)} FT`, COLORS.hudText);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.round(plane.speed * 2.1)} KT`, pad + 122, pad + 46);
  ctx.fillStyle = COLORS.hudAmber;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('SPEED', pad + 122, pad + 20);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`${String(headingDegrees).padStart(3, '0')}°`, pad + 222, pad + 46);
  ctx.fillStyle = COLORS.hudAmber;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('HEADING', pad + 222, pad + 20);
  // Compass strip across the top centre.
  const compassY = pad + 22;
  ctx.fillStyle = COLORS.hudPanel;
  ctx.beginPath();
  ctx.roundRect(width / 2 - 130, pad, 260, 34, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  const marks = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  for (let index = -2; index <= 2; index += 1) {
    const markIndex = ((Math.round(headingDegrees / 45) + index) % 8 + 8) % 8;
    ctx.fillText(marks[markIndex], width / 2 + index * 52, compassY + 6);
  }
  ctx.fillStyle = COLORS.hudAmber;
  ctx.fillRect(width / 2 - 1, pad + 26, 2, 8);
  // Right: score and rings.
  hudPanel(ctx, width - 264, pad, 250, 64);
  hudReadout(ctx, width - 252, pad + 20, 'SCORE', String(world.score), COLORS.hudText);
  ctx.fillStyle = COLORS.hudAmber;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('RINGS', width - 148, pad + 20);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`${world.ringsFlown} / ${world.ringsSeen + 1}`, width - 148, pad + 46);
  // Bottom-left: fuel and time bars.
  const barY = height - (view === 'cockpit' ? height * 0.24 + 58 : 58);
  hudPanel(ctx, pad, barY - 8, 250, 52);
  ctx.fillStyle = COLORS.hudAmber;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`FUEL ${Math.round(world.fuel)}%`, pad + 12, barY + 8);
  ctx.fillStyle = '#12303f';
  ctx.fillRect(pad + 74, barY - 2, 160, 9);
  ctx.fillStyle = world.fuel < 25 ? COLORS.hudRed : COLORS.hudGreen;
  ctx.fillRect(pad + 74, barY - 2, 160 * (world.fuel / 100), 9);
  ctx.fillStyle = COLORS.hudAmber;
  ctx.fillText(`TIME ${Math.ceil(world.timeLeft)}s`, pad + 12, barY + 30);
  ctx.fillStyle = '#12303f';
  ctx.fillRect(pad + 74, barY + 20, 160, 9);
  ctx.fillStyle = world.timeLeft < 30 ? COLORS.hudRed : '#7fb2dd';
  ctx.fillRect(pad + 74, barY + 20, 160 * Math.max(0, world.timeLeft / 150), 9);
  // Throttle bar, right edge.
  const throttleHeight = 130;
  const throttleTop = height / 2 - throttleHeight / 2;
  ctx.fillStyle = COLORS.hudPanel;
  ctx.beginPath();
  ctx.roundRect(width - 34, throttleTop, 20, throttleHeight, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.hudAmber;
  const fillHeight = throttleHeight * plane.throttle;
  ctx.fillRect(width - 32, throttleTop + throttleHeight - fillHeight, 16, fillHeight);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THR', width - 24, throttleTop - 8);
  // Next-ring distance, under the compass.
  const ring = nextRing(world);
  const ringDistance = Math.max(0, Math.round(ring.z - plane.z));
  ctx.fillStyle = COLORS.hudAmber;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`NEXT RING ${ring.index + 1} — ${ringDistance}m`, width / 2, pad + 66);
  // Flash message for rings and near misses.
  if (world.messageTime > 0 && world.message) {
    ctx.globalAlpha = Math.min(1, world.messageTime);
    ctx.fillStyle = COLORS.hudAmber;
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.message, width / 2, height * 0.17);
    ctx.globalAlpha = 1;
  }
}

function drawTitleScreen(ctx, world, width, height) {
  ctx.fillStyle = 'rgba(6, 14, 24, 0.55)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.hudAmber;
  ctx.font = `bold ${Math.round(width * 0.055)}px sans-serif`;
  ctx.fillText('RING RUNNER RIDGE', width / 2, height * 0.3);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = `bold ${Math.round(width * 0.02)}px sans-serif`;
  ctx.fillText('Fly the valley. Thread every glowing ring. Mind the mountains.', width / 2, height * 0.38);
  ctx.font = '18px sans-serif';
  ctx.fillText('ARROWS / WASD — pitch & roll      W / S — throttle      SPACE — boost', width / 2, height * 0.5);
  ctx.fillText('Each ring scores +100 and adds 8 seconds. Fuel and the clock are always running.', width / 2, height * 0.55);
  ctx.fillStyle = COLORS.hudGreen;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO FLY', width / 2, height * 0.66);
  if (world.best > 0) {
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`BEST SCORE ${world.best}`, width / 2, height * 0.73);
  }
}

function drawGameOverScreen(ctx, world, width, height) {
  ctx.fillStyle = 'rgba(6, 10, 18, 0.62)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.hudRed;
  ctx.font = `bold ${Math.round(width * 0.05)}px sans-serif`;
  ctx.fillText('FLIGHT OVER', width / 2, height * 0.3);
  ctx.fillStyle = COLORS.hudAmber;
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(world.crashReason, width / 2, height * 0.38);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(`SCORE ${world.score}`, width / 2, height * 0.48);
  ctx.font = '20px sans-serif';
  ctx.fillText(`RINGS FLOWN ${world.ringsFlown}   •   BEST ${Math.max(world.best, world.score)}`, width / 2, height * 0.55);
  ctx.fillStyle = COLORS.hudGreen;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('PRESS ENTER OR CLICK TO FLY AGAIN', width / 2, height * 0.66);
}

/**
 * Draw one frame of the game. `view` is 'chase' or 'cockpit'; the title and
 * game-over screens draw over the live world behind them.
 */
export function renderGame(ctx, world, view, width, height) {
  const camera = view === 'cockpit' ? cockpitCamera(world) : chaseCamera(world);
  drawSky(ctx, width, height, camera);
  drawTerrainSlices(ctx, camera, width, height);
  drawRiverRibbon(ctx, camera, width, height);
  drawTrees(ctx, camera, world, width, height);
  drawRings(ctx, camera, world, width, height);
  if (view === 'cockpit') drawCockpit(ctx, world, width, height);
  else if (world.phase !== PHASE_TITLE) drawChasePlane(ctx, world, width, height);
  if (world.phase === PHASE_FLYING || world.phase === PHASE_OVER) {
    drawHud(ctx, world, width, height, view);
  }
  if (world.phase === PHASE_TITLE) drawTitleScreen(ctx, world, width, height);
  if (world.phase === PHASE_OVER) drawGameOverScreen(ctx, world, width, height);
}
