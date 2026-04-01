/**
 * @fileoverview Лабораторна робота №2
 * Моделювання руху тіла, кинутого під кутом до горизонту
 * Мова: JavaScript (ES6+) · Візуалізація: D3.js v7
 *
 * Формули кінематики:
 *   v0x = v0·cos(β)              — горизонтальна проекція швидкості
 *   v0y = v0·sin(β)              — вертикальна проекція швидкості
 *   x(t) = v0x·t                 — горизонтальна координата
 *   y(t) = v0y·t − g·t²/2        — вертикальна координата (звичайна)
 *   y_inv(t) = −v0y·t + g·t²/2   — вертикальна координата (перевернута)
 *   T    = 2·v0·sin(β)/g         — повний час польоту
 *   h    = v0²·sin²(β)/(2g)      — максимальна висота
 *   l    = v0²·sin(2β)/g         — дальність польоту
 */

'use strict';

const G_DEFAULT    = 9.81;
const DT           = 0.05;
const ANIM_DURATION = 2800;

// ─── Фізичні розрахунки ───────────────────────────────────────────────────

/** Переводить градуси у радіани. */
function toRadians(deg) { return deg * Math.PI / 180; }

/**
 * Розраховує траєкторію звичайного кидка (парабола вгору).
 * x(t) = v0·cos(β)·t
 * y(t) = v0·sin(β)·t − g·t²/2
 */
function calculateTrajectory(v0, angleDeg, g = G_DEFAULT) {
  const beta = toRadians(angleDeg);
  const v0x  = v0 * Math.cos(beta);
  const v0y  = v0 * Math.sin(beta);

  const T = (2 * v0y) / g;                         // (2.4) час польоту
  const h = (v0y * v0y) / (2 * g);                 // (2.9) максимальна висота
  const l = (v0 * v0 * Math.sin(2 * beta)) / g;    // (2.5) дальність

  const points = [];
  for (let t = 0; t <= T + DT; t += DT) {
    const tc = Math.min(t, T);
    const x  = v0x * tc;
    const y  = v0y * tc - (g * tc * tc) / 2;
    if (y < -0.01) break;
    points.push({ x: +x.toFixed(4), y: +Math.max(0, y).toFixed(4) });
  }
  if (points[points.length - 1]?.y !== 0)
    points.push({ x: +l.toFixed(4), y: 0 });

  return { points, T, h, l };
}

/**
 * Розраховує перевернуту траєкторію (парабола вниз).
 * Тіло стартує зверху і падає донизу:
 *   y_inv(t) = h − (h/T²)·(t − T/2)² = h − v0y·t + g·t²/2
 * Тобто просто дзеркало відносно осі y: y_inv = h − y_orig
 */
function calculateInvertedTrajectory(v0, angleDeg, g = G_DEFAULT) {
  const { points, T, h, l } = calculateTrajectory(v0, angleDeg, g);

  // Дзеркалимо по вертикалі: y_inv = h − y_orig
  const invPoints = points.map(p => ({ x: p.x, y: +(h - p.y).toFixed(4) }));

  return { points: invPoints, T, h, l };
}

// ─── D3.js – спільні утиліти ──────────────────────────────────────────────

let svgNormal   = null;
let svgInverted = null;
let animTimer1  = null;
let animTimer2  = null;

function initSvg(containerId) {
  const el = document.getElementById(containerId);
  d3.select('#' + containerId).selectAll('*').remove();
  const svg = d3.select('#' + containerId)
    .append('svg')
    .attr('width', el.clientWidth)
    .attr('height', el.clientHeight);
  svg._W = el.clientWidth;
  svg._H = el.clientHeight;
  return svg;
}

/**
 * Будує графік у вказаному SVG-елементі.
 *
 * @param {object} svg        — D3 selection
 * @param {Array}  points     — масив {x, y}
 * @param {number} h          — максимальна висота (або глибина для inv)
 * @param {number} l          — дальність
 * @param {boolean} inverted  — true = перевернута версія
 */
function drawChart(svg, points, h, l, inverted) {
  const W = svg._W, H = svg._H;
  const margin = { top: 28, right: 30, bottom: 52, left: 58 };
  const width  = W - margin.left - margin.right;
  const height = H - margin.top  - margin.bottom;

  svg.selectAll('*').remove();
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Масштаби
  const xScale = d3.scaleLinear().domain([0, l * 1.08]).range([0, width]);
  const yMax   = h * 1.25;
  const yScale = d3.scaleLinear().domain([0, yMax]).range([height, 0]);

  // Сітка
  g.append('g').attr('class', 'grid').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(6).tickSize(-height).tickFormat(''));
  g.append('g').attr('class', 'grid')
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-width).tickFormat(''));

  // Земля / стеля
  if (!inverted) {
    g.append('rect').attr('class','ground-fill')
      .attr('x',0).attr('y',yScale(0)).attr('width',width).attr('height', height - yScale(0) + 10);
    g.append('line').attr('class','ground-line')
      .attr('x1',0).attr('y1',yScale(0)).attr('x2',width).attr('y2',yScale(0));
  } else {
    // У перевернутій версії y=h — це «стеля» (старт + приземлення зверху)
    g.append('rect').attr('class','ceiling-fill')
      .attr('x',0).attr('y',0).attr('width',width).attr('height', yScale(h));
    g.append('line').attr('class','ceiling-line')
      .attr('x1',0).attr('y1',yScale(h)).attr('x2',width).attr('y2',yScale(h));
  }

  // Осі
  g.append('g').attr('class','axis').attr('transform',`translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat(d => d + ' м'));
  g.append('g').attr('class','axis')
    .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => d.toFixed(0) + ' м'));

  g.append('text').attr('class','axis-label').attr('text-anchor','middle')
    .attr('x', width/2).attr('y', height + 42).text('Горизонтальна відстань x (м)');
  g.append('text').attr('class','axis-label').attr('text-anchor','middle')
    .attr('transform','rotate(-90)').attr('x', -height/2).attr('y', -44)
    .text('Висота y (м)');

  // Апогей / найнижча точка
  const extremePt = inverted
    ? points.reduce((b, p) => p.y < b.y ? p : b, points[0])   // мінімум у перевернутій
    : points.reduce((b, p) => p.y > b.y ? p : b, points[0]);  // максимум у звичайній
  const extremeY  = inverted ? 0 : h;   // реальна фізична координата для підпису

  // Пунктирні маркери
  g.append('line').attr('class','marker-line')
    .attr('x1', xScale(extremePt.x)).attr('y1', yScale(inverted ? 0 : h))
    .attr('x2', xScale(extremePt.x)).attr('y2', inverted ? height : yScale(h));
  g.append('line').attr('class','marker-line')
    .attr('x1', 0).attr('y1', yScale(inverted ? 0 : h))
    .attr('x2', xScale(extremePt.x)).attr('y2', yScale(inverted ? 0 : h));

  const labelY = inverted
    ? yScale(h/2)
    : yScale(h/2);
  g.append('text').attr('class','marker-label')
    .attr('x', xScale(extremePt.x) + 5).attr('y', labelY)
    .text(`h = ${h.toFixed(1)} м`);

  // Тінь + основна крива
  const lineGen = d3.line()
    .x(d => xScale(d.x)).y(d => yScale(d.y))
    .curve(d3.curveCatmullRom.alpha(0.5));

  const bgClass   = inverted ? 'trajectory-path-bg-inv' : 'trajectory-path-bg';
  const pathClass = inverted ? 'trajectory-path-inv'    : 'trajectory-path';

  g.append('path').datum(points).attr('class', bgClass).attr('d', lineGen);

  const path = g.append('path').datum(points).attr('class', pathClass).attr('d', lineGen);
  const len  = path.node().getTotalLength();
  path.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len)
    .transition().duration(ANIM_DURATION * 0.6).ease(d3.easeLinear)
    .attr('stroke-dashoffset', 0);

  // Точка апогею / надиру
  const dotClass = inverted ? 'nadir-dot' : 'apex-dot';
  g.append('circle').attr('class', dotClass)
    .attr('cx', xScale(extremePt.x)).attr('cy', yScale(extremePt.y)).attr('r', 0)
    .transition().delay(ANIM_DURATION * 0.55).duration(300).attr('r', 6);

  // Анімоване тіло
  const ballClass = inverted ? 'projectile-inv' : 'projectile';
  const ball = g.append('circle').attr('class', ballClass).attr('r', 7)
    .attr('cx', xScale(points[0].x)).attr('cy', yScale(points[0].y));

  return ball;
}

/**
 * Анімує рух тіла вздовж масиву точок.
 */
function animateBall(ball, points, xScale, yScale, existingTimer) {
  if (existingTimer) existingTimer.stop();
  let idx = 0;
  const step = Math.max(1, Math.floor(points.length / 120));
  return d3.interval(() => {
    if (idx >= points.length) { existingTimer && existingTimer.stop(); return; }
    ball.transition().duration(ANIM_DURATION / (points.length / step))
      .ease(d3.easeLinear)
      .attr('cx', xScale(points[idx].x))
      .attr('cy', yScale(points[idx].y));
    idx += step;
  }, ANIM_DURATION / (points.length / step));
}

// ─── UI ───────────────────────────────────────────────────────────────────

function updateResults(T, h, l) {
  document.querySelector('#res-time .res-value').textContent   = T.toFixed(2);
  document.querySelector('#res-height .res-value').textContent = h.toFixed(2);
  document.querySelector('#res-range .res-value').textContent  = l.toFixed(2);
  document.querySelectorAll('.result-card').forEach(c => c.classList.add('active'));
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ─── Головний запуск ──────────────────────────────────────────────────────

function run() {
  const v0    = parseFloat(document.getElementById('velocity').value);
  const angle = parseFloat(document.getElementById('angle').value);
  const grav  = parseFloat(document.getElementById('gravity').value) || G_DEFAULT;

  if (isNaN(v0) || v0 <= 0 || v0 > 500) { showError('Введіть коректну початкову швидкість (1–500 м/с)'); return; }
  if (isNaN(angle) || angle <= 0 || angle >= 91) { showError('Введіть коректний кут кидання (1°–90°)'); return; }

  // Розрахунок обох траєкторій
  const normal   = calculateTrajectory(v0, angle, grav);
  const inverted = calculateInvertedTrajectory(v0, angle, grav);

  // Ініціалізація SVG
  svgNormal   = initSvg('chart');
  svgInverted = initSvg('chart-inverted');

  // Побудова графіків
  const xScaleN = d3.scaleLinear().domain([0, normal.l * 1.08]).range([0, svgNormal._W  - 88]);
  const xScaleI = d3.scaleLinear().domain([0, inverted.l * 1.08]).range([0, svgInverted._W - 88]);
  const yScaleN = d3.scaleLinear().domain([0, normal.h * 1.25]).range([svgNormal._H  - 80, 0]);
  const yScaleI = d3.scaleLinear().domain([0, inverted.h * 1.25]).range([svgInverted._H - 80, 0]);

  const ballN = drawChart(svgNormal,   normal.points,   normal.h,   normal.l,   false);
  const ballI = drawChart(svgInverted, inverted.points, inverted.h, inverted.l, true);

  animTimer1 = animateBall(ballN, normal.points,   xScaleN, yScaleN, animTimer1);
  animTimer2 = animateBall(ballI, inverted.points, xScaleI, yScaleI, animTimer2);

  updateResults(normal.T, normal.h, normal.l);
}

function reset() {
  document.getElementById('velocity').value     = 50;
  document.getElementById('velocityRange').value = 50;
  document.getElementById('angle').value        = 45;
  document.getElementById('angleRange').value   = 45;
  document.querySelectorAll('.result-card').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.res-value').forEach(v => v.textContent = '—');
  if (animTimer1) animTimer1.stop();
  if (animTimer2) animTimer2.stop();
  if (svgNormal)   svgNormal.selectAll('*').remove();
  if (svgInverted) svgInverted.selectAll('*').remove();
}

// ─── Ініціалізація ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  svgNormal   = initSvg('chart');
  svgInverted = initSvg('chart-inverted');

  document.getElementById('btnLaunch').addEventListener('click', run);
  document.getElementById('btnReset').addEventListener('click', reset);

  const sync = (sId, nId) => {
    const s = document.getElementById(sId), n = document.getElementById(nId);
    s.addEventListener('input', () => { n.value = s.value; });
    n.addEventListener('input', () => { s.value = Math.min(Math.max(n.value, s.min), s.max); });
  };
  sync('velocityRange', 'velocity');
  sync('angleRange',    'angle');

  document.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });

  window.addEventListener('resize', () => {
    const v0 = parseFloat(document.getElementById('velocity').value);
    const a  = parseFloat(document.getElementById('angle').value);
    if (v0 > 0 && a > 0 && a < 90) run();
  });

  run(); // Запуск за замовчуванням
});
