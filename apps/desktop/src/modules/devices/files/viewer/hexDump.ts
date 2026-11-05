export interface HexRow {
  offset: string;
  hex: string;
  ascii: string;
}

const HEX = Array.from({ length: 256 }, (_, byte) => byte.toString(16).padStart(2, "0"));

function printable(byte: number): string {
  return byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : ".";
}

/**
 * Classic hex dump rows: an 8-digit offset, `width` bytes in hex with a wider gap at the middle,
 * and their printable ASCII. A short last row is padded so the ASCII column stays aligned.
 */
export function hexRows(bytes: Uint8Array, width = 16): HexRow[] {
  const rows: HexRow[] = [];
  const half = width / 2;
  for (let start = 0; start < bytes.length; start += width) {
    const cells: string[] = [];
    let ascii = "";
    for (let column = 0; column < width; column += 1) {
      const byte = bytes[start + column];
      const cell = byte === undefined ? "  " : (HEX[byte] ?? "??");
      cells.push(column === half ? ` ${cell}` : cell);
      if (byte !== undefined) ascii += printable(byte);
    }
    rows.push({
      offset: start.toString(16).padStart(8, "0"),
      hex: cells.join(" "),
      ascii,
    });
  }
  return rows;
}
