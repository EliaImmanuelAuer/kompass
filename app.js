'use strict';

const SMOOTHING = 0.15; // share of the remaining angle the dial turns per frame
const SENSOR_TIMEOUT = 4000;

const $ = id => document.getElementById(id);
const dial = $('dial'), headingEl = $('heading'), dirEl = $('dir');
const statusEl = $('status'), startBtn = $('start'), main = document.querySelector('main');

let north = null;         // true bearing currently shown as north
let deviceHeading = null; // true heading of the phone
let rotation = null;      // smoothed, unwrapped dial rotation in degrees
let shownHeading = null;
const labels = [];        // dial texts, kept upright while the dial turns

function setStatus(text) {
  statusEl.textContent = text;
  statusEl.hidden = !text;
}

// ---- dial ----------------------------------------------------------------

function buildDial() {
  const ns = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, text) => {
    const n = document.createElementNS(ns, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text) n.textContent = text;
    dial.appendChild(n);
    return n;
  };
  const label = (text, angle, radius, cls) =>
    labels.push({ node: el('text', { class: cls }, text), angle, radius });
  for (let d = 0; d < 360; d += 2) {
    const major = d % 30 === 0;
    el('line', {
      x1: 0, y1: -140, x2: 0, y2: major ? -126 : -133,
      class: major ? 'tick major' : 'tick',
      transform: `rotate(${d})`,
    });
  }
  for (let d = 0; d < 360; d += 30) label(String(d), d, 110, 'deg');
  ['N', 'O', 'S', 'W'].forEach((l, i) => label(l, i * 90, 78, l === 'N' ? 'card north' : 'card'));
  placeLabels(0);
}

function placeLabels(rot) {
  for (const { node, angle, radius } of labels) {
    node.setAttribute('transform', `rotate(${angle}) translate(0 ${-radius}) rotate(${(-angle - rot).toFixed(1)})`);
  }
}

function frame() {
  if (north !== null && deviceHeading !== null) {
    const target = north - deviceHeading;
    rotation = rotation === null ? target : rotation + SMOOTHING * wrap180(target - rotation);
    dial.style.transform = `rotate(${rotation.toFixed(2)}deg)`;
    placeLabels(rotation);

    const h = Math.round(norm(-rotation)) % 360;
    if (h !== shownHeading) {
      shownHeading = h;
      headingEl.textContent = h + '°';
      dirEl.textContent = directionName(h);
    }
    if (main.classList.contains('waiting')) {
      main.classList.remove('waiting');
      setStatus('');
    }
  }
  requestAnimationFrame(frame);
}

// ---- sensors -------------------------------------------------------------

function screenAngle() {
  return (screen.orientation && screen.orientation.angle) || window.orientation || 0;
}

function onOrientation(e) {
  let h;
  if (typeof e.webkitCompassHeading === 'number') {
    if (e.webkitCompassHeading < 0) return; // iOS: not calibrated
    h = e.webkitCompassHeading;
  } else if ((e.absolute || e.type === 'deviceorientationabsolute') && e.alpha !== null) {
    h = headingFromAngles(e.alpha, e.beta, e.gamma);
  } else {
    return;
  }
  deviceHeading = norm(h + screenAngle() + DECLINATION);
}

function onPosition(pos) {
  const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
  north = pseudoNorth(here);
  try { localStorage.setItem('lastPos', JSON.stringify(here)); } catch (_) {}
}

function onPositionError(err) {
  if (err.code === err.PERMISSION_DENIED) {
    setStatus('Bitte erlaube den Standortzugriff, damit der Kompass den geografischen Norden anzeigen kann.');
  }
}

function startSensors() {
  startBtn.hidden = true;
  setStatus('Kalibrierung …');

  if ('ondeviceorientationabsolute' in window) {
    window.addEventListener('deviceorientationabsolute', onOrientation);
  } else {
    window.addEventListener('deviceorientation', onOrientation);
  }
  setTimeout(() => {
    if (deviceHeading === null) setStatus('Auf diesem Gerät wurde kein Kompass-Sensor gefunden.');
  }, SENSOR_TIMEOUT);

  if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition(onPosition, onPositionError,
      { enableHighAccuracy: true, maximumAge: 10000 });
  } else {
    setStatus('Standortbestimmung wird von diesem Browser nicht unterstützt.');
  }
}

// ---- start ---------------------------------------------------------------

buildDial();
requestAnimationFrame(frame);

try {
  const last = JSON.parse(localStorage.getItem('lastPos'));
  if (last) north = pseudoNorth(last);
} catch (_) {}

if (!window.isSecureContext) {
  setStatus('Bitte die App über https:// öffnen.');
} else if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
  // iOS only grants compass access after a tap.
  startBtn.hidden = false;
  setStatus('');
  startBtn.addEventListener('click', () => {
    DeviceOrientationEvent.requestPermission()
      .then(state => state === 'granted'
        ? startSensors()
        : setStatus('Ohne Zugriff auf Bewegung & Ausrichtung kann der Kompass nicht funktionieren.'))
      .catch(() => setStatus('Zugriff auf den Kompass-Sensor nicht möglich.'));
  });
} else {
  startSensors();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
