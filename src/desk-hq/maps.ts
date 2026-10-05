export interface MapSector {
  id: string;
  label: string;
  west: number;
  east: number;
  south: number;
  north: number;
}

export const MAP_SECTORS: MapSector[] = [
  { id: 'eu-atlantic', label: 'EU · ATLANTIC', west: -25, east: 45, south: 28, north: 68 },
  { id: 'americas', label: 'AMERICAS', west: -165, east: -35, south: -50, north: 70 },
  { id: 'asia-pacific', label: 'ASIA · PACIFIC', west: 65, east: 175, south: -42, north: 68 },
];

/** Coarse original silhouettes. They are a thumbnail, not a navigational chart. */
const LAND: Array<Array<[number, number]>> = [
  [[-168, 66], [-140, 70], [-105, 72], [-88, 64], [-70, 58], [-68, 44], [-80, 26], [-97, 22], [-112, 28], [-125, 48], [-150, 60], [-168, 66]],
  [[-80, 10], [-70, 12], [-52, 6], [-36, -8], [-38, -22], [-54, -38], [-72, -52], [-76, -18], [-80, -2], [-80, 10]],
  [[-10, 36], [-2, 44], [8, 50], [20, 54], [28, 46], [24, 38], [12, 36], [2, 36], [-10, 36]],
  [[-16, 34], [8, 36], [28, 32], [42, 12], [40, -16], [28, -34], [16, -32], [8, -12], [-12, 6], [-16, 20], [-16, 34]],
  [[32, 32], [48, 42], [70, 50], [100, 58], [140, 66], [165, 64], [148, 42], [122, 22], [104, 8], [78, 8], [64, 22], [48, 16], [36, 22], [32, 32]],
  [[114, -18], [128, -12], [144, -14], [152, -28], [146, -38], [130, -34], [116, -32], [114, -18]],
];

export function drawSectorMap(canvas: HTMLCanvasElement, sector: MapSector): void {
  const width = Math.max(220, canvas.clientWidth || 320);
  const height = 132;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = '#071018';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#13202b';
  ctx.lineWidth = 1;
  for (let lon = Math.ceil(sector.west / 20) * 20; lon < sector.east; lon += 20) {
    const x = ((lon - sector.west) / (sector.east - sector.west)) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let lat = Math.ceil(sector.south / 15) * 15; lat < sector.north; lat += 15) {
    const y = ((sector.north - lat) / (sector.north - sector.south)) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const project = (lon: number, lat: number): [number, number] => [
    ((lon - sector.west) / (sector.east - sector.west)) * width,
    ((sector.north - lat) / (sector.north - sector.south)) * height,
  ];

  ctx.fillStyle = '#1b3a34';
  ctx.strokeStyle = '#2f6b5c';
  ctx.lineWidth = 1;
  for (const ring of LAND) {
    ctx.beginPath();
    ring.forEach(([lon, lat], index) => {
      const [x, y] = project(lon, lat);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
