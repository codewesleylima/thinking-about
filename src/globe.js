// Terra estilizada em projeção ortográfica. Longitudes giram; geometria e linhas
// de latitude/longitude são calculadas localmente, sem assets ou serviços externos.
const radians = Math.PI / 180;
const continents = [
  [[-168, 70], [-130, 72], [-125, 60], [-100, 55], [-82, 25], [-90, 15], [-110, 30], [-125, 50], [-165, 55]],
  [[-82, 12], [-65, 10], [-50, -5], [-35, -7], [-48, -30], [-65, -55], [-76, -35]],
  [[-10, 36], [-10, 58], [20, 72], [80, 75], [170, 60], [160, 45], [135, 35], [115, 20], [100, 5], [78, 8], [70, 27], [40, 34], [25, 40]],
  [[-18, 36], [8, 37], [35, 30], [50, 12], [42, -12], [28, -35], [12, -35], [-5, -5], [-18, 15]],
  [[112, -12], [135, -10], [153, -24], [145, -39], [116, -33]],
  [[-60, 82], [-20, 80], [-40, 60], [-58, 62]]
];
function inside(x, y, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) result = !result;
  }
  return result;
}
export function globeFrame(width = 29, angle = 0, options = {}) {
  width = Math.max(13, Math.min(31, Math.floor(width)));
  const height = options.height || Math.max(5, 2 * Math.floor(width / 4) - 1);
  return Array.from({ length: height }, (_, row) => Array.from({ length: width }, (_, col) => {
    const x = (col / (width - 1) * 2 - 1) * 1.04, y = (1 - row / (height - 1) * 2) * 0.98;
    const radius = x * x + y * y;
    if (radius > 1) return { char: ' ', tone: 'void' };
    const z = Math.sqrt(1 - radius), tilt = -0.23;
    const latitude = Math.asin(y * Math.cos(tilt) - z * Math.sin(tilt));
    const longitude = Math.atan2(x, y * Math.sin(tilt) + z * Math.cos(tilt)) + angle;
    const lon = ((longitude / radians + 180) % 360 + 360) % 360 - 180, lat = latitude / radians;
    const land = lat < -72 || continents.some(polygon => inside(lon, lat, polygon));
    const meridian = Math.abs(Math.sin(longitude * 6)) < 0.13, parallel = Math.abs(Math.sin(latitude * 6)) < 0.14;
    const step = 2.08 / (width - 1);
    if (z < 0.28 || (x - step) ** 2 + y * y > 1 || (x + step) ** 2 + y * y > 1 || row === 0 || row === height - 1) return { char: '·', tone: 'rim' };
    if (meridian && parallel) return { char: '+', tone: 'node' };
    if (land) return { char: z > 0.7 ? '▓' : '▒', tone: z > 0.7 ? 'land' : 'shadow' };
    if (meridian || parallel) return { char: '·', tone: 'grid' };
    return { char: ' ', tone: 'void' };
  }));
}

// Braille usa subpixels 2x4: um planeta de 13x11 pontos cabe em 7x3 células.
export function miniGlobeFrame(angle = 0) {
  const pixels = globeFrame(13, angle, { height: 11 });
  const dots = [[1, 8], [2, 16], [4, 32], [64, 128]];
  return Array.from({ length: 3 }, (_, row) => Array.from({ length: 7 }, (_, col) => {
    let mask = 0, land = false;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 2; x++) {
      const pixel = pixels[row * 4 + y]?.[col * 2 + x];
      if (pixel && pixel.tone !== 'void') mask |= dots[y][x];
      if (pixel && ['land', 'shadow'].includes(pixel.tone)) land = true;
    }
    return { char: String.fromCharCode(0x2800 + mask), tone: land ? 'land' : 'rim' };
  }));
}
