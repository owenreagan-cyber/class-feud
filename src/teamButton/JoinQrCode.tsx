import qrcode from 'qrcode-generator';

const QUIET_ZONE_MODULES = 2;

/**
 * Renders a QR code for the given value as inline SVG (no canvas, no
 * external image/service — the code is computed entirely client-side from
 * whatever `value` is passed in, e.g. the already-computed join URL). Scales
 * cleanly via viewBox, so it stays crisp on a projector at any size.
 */
export default function JoinQrCode({ value, size = 132 }: { value: string; size?: number }) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const total = moduleCount + QUIET_ZONE_MODULES * 2;

  const darkModules: { row: number; col: number }[] = [];
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qr.isDark(row, col)) darkModules.push({ row, col });
    }
  }

  return (
    <svg
      className="tb-join-qr"
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label={`QR code linking to ${value}`}
    >
      <rect width={total} height={total} fill="#fff" />
      {darkModules.map(({ row, col }) => (
        <rect
          key={`${row}-${col}`}
          x={col + QUIET_ZONE_MODULES}
          y={row + QUIET_ZONE_MODULES}
          width={1}
          height={1}
          fill="#0b0f1d"
        />
      ))}
    </svg>
  );
}
