export const fmtLat = (lat, d = 2) => `${Math.abs(lat).toFixed(d)}°${lat >= 0 ? 'N' : 'S'}`;
export const fmtLon = (lon, d = 2) => `${Math.abs(lon).toFixed(d)}°${lon >= 0 ? 'E' : 'W'}`;
export const fmtDist = (m) => (m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m)} m`);
export const fmtBytes = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} kB`);
