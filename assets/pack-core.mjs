/** Dependency-free, local-only stored ZIP creator. No network requests or server processing. */
const encoder = new TextEncoder();
const CRC_TABLE = Uint32Array.from({length: 256}, (_, k) => {
  let c = k;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
export function validateDimensions(width, height, maxKB) {
  if (!Number.isInteger(width) || width < 16 || width > 4000 || !Number.isInteger(height) || height < 16 || height > 4000)
    throw new Error('Enter whole-number image dimensions between 16 and 4000 pixels.');
  if (!Number.isFinite(maxKB) || maxKB < 5 || maxKB > 10240)
    throw new Error('Image size limit must be between 5 and 10240 KB.');
}
export function isPdfHeader(bytes) {
  return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0,5)) === '%PDF-';
}
export function asSize(bytes) { return bytes < 1024 * 1024 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1024/1024).toFixed(2)} MB`; }
export async function createZip(items) {
  if (!items.length || items.length > 12) throw new Error('Choose between 1 and 12 files.');
  const chunks = [], directory = [];
  let offset = 0;
  let total = 0;
  const stamp = new Date();
  const dosTime = (Math.min(23, stamp.getHours()) << 11) | (stamp.getMinutes() << 5) | Math.floor(stamp.getSeconds() / 2);
  const dosDate = (Math.max(0,stamp.getFullYear()-1980) << 9) | ((stamp.getMonth()+1) << 5) | stamp.getDate();
  for (const item of items) {
    const name = item.name;
    if (!/^[a-zA-Z0-9][\w .-]{0,99}$/.test(name) || name.includes('..')) throw new Error('Invalid ZIP filename.');
    const fileName = encoder.encode(name);
    const bytes = new Uint8Array(await item.blob.arrayBuffer());
    total += bytes.length;
    if (total > 80 * 1024 * 1024) throw new Error('Document pack exceeds the 80 MB browser limit.');
    const hash = crc32(bytes);
    const header = new Uint8Array(30 + fileName.length);
    const view = new DataView(header.buffer);
    view.setUint32(0,0x04034b50,true); view.setUint16(4,20,true); view.setUint16(6,0x0800,true);
    view.setUint16(8,0,true); view.setUint16(10,dosTime,true); view.setUint16(12,dosDate,true);
    view.setUint32(14,hash,true); view.setUint32(18,bytes.length,true); view.setUint32(22,bytes.length,true);
    view.setUint16(26,fileName.length,true);header.set(fileName,30);
    chunks.push(header,bytes);
    const central = new Uint8Array(46+fileName.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);
    cv.setUint16(8,0x0800,true);cv.setUint16(10,0,true);cv.setUint16(12,dosTime,true);
    cv.setUint16(14,dosDate,true);cv.setUint32(16,hash,true);cv.setUint32(20,bytes.length,true);
    cv.setUint32(24,bytes.length,true);cv.setUint16(28,fileName.length,true);
    cv.setUint32(42,offset,true);central.set(fileName,46);
    directory.push(central);offset += header.length + bytes.length;
  }
  const directoryLength = directory.reduce((acc,c)=>acc+c.length,0);
  const footer = new Uint8Array(22), end = new DataView(footer.buffer);
  end.setUint32(0,0x06054b50,true);end.setUint16(8,items.length,true);
  end.setUint16(10,items.length,true);end.setUint32(12,directoryLength,true);
  end.setUint32(16,offset,true);
  return new Blob([...chunks,...directory,footer],{type:'application/zip'});
}
