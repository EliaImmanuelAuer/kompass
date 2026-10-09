'use strict';

// Fixed reference point. The displayed "north" is always perpendicular to the
// line towards it: bearing to the center minus 90°. Standing west of it the
// needle shows true north, north of it true east, east of it true south, etc.
const CENTER = { lat: 52.16568078338036, lon: 13.492648821560424 };

// Phone compasses measure magnetic north. Magnetic declination around Berlin
// (2026) is about 5.3° east, so true heading = magnetic heading + 5.3°.
const DECLINATION = 5.3;

const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const norm = a => ((a % 360) + 360) % 360;
const wrap180 = a => norm(a + 180) - 180;

// Initial great-circle bearing from `from` to `to`, degrees clockwise from true north.
function bearing(from, to) {
  const p1 = rad(from.lat), p2 = rad(to.lat), dl = rad(to.lon - from.lon);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return norm(deg(Math.atan2(y, x)));
}

// True bearing that the compass presents as "north" at the given position.
function pseudoNorth(here) {
  return norm(bearing(here, CENTER) - 90);
}

// Heading from W3C DeviceOrientation angles (earth frame, alpha counter-clockwise).
// Uses the direction of the device's top edge while the phone is roughly flat and
// blends over to the direction of its back as it is raised upright, where the
// top edge points to the sky and no longer has a usable horizontal direction.
function headingFromAngles(alpha, beta, gamma) {
  const a = rad(alpha), b = rad(beta || 0), g = rad(gamma || 0);
  const sA = Math.sin(a), cA = Math.cos(a), sB = Math.sin(b), cB = Math.cos(b);
  const sG = Math.sin(g), cG = Math.cos(g);
  const topE = -sA, topN = cA; // horizontal top direction, normalised (length was cB)
  let backE = -cA * sG - sA * sB * cG, backN = -sA * sG + cA * sB * cG;
  const backLen = Math.hypot(backE, backN) || 1;
  backE /= backLen; backN /= backLen;
  const w = Math.min(1, Math.max(0, (cB - 0.2) / 0.3)); // 1 = flat, 0 = upright
  return norm(deg(Math.atan2(w * topE + (1 - w) * backE, w * topN + (1 - w) * backN)));
}

const DIRECTIONS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
const directionName = h => DIRECTIONS[Math.round(norm(h) / 45) % 8];
