/** ภาพนิ่ง (SVG) แทนโมเดล 3D เมื่ออุปกรณ์ไม่รองรับ WebGL หรือเปิด reduced motion */
export function StaticCoin({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="เหรียญ">
      <defs>
        <radialGradient id="sc-face" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#E9D5FF" />
          <stop offset=".45" stopColor="#A78BFA" />
          <stop offset="1" stopColor="#4C1D95" />
        </radialGradient>
        <linearGradient id="sc-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C4B5FD" />
          <stop offset="1" stopColor="#3730A3" />
        </linearGradient>
        <radialGradient id="sc-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#8B5CF6" stopOpacity=".45" />
          <stop offset="1" stopColor="#8B5CF6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill="url(#sc-glow)" />
      <ellipse cx="100" cy="176" rx="46" ry="6" fill="#000" opacity=".25" />
      <circle cx="104" cy="100" r="60" fill="url(#sc-rim)" />
      <circle cx="100" cy="98" r="60" fill="url(#sc-face)" />
      <circle cx="100" cy="98" r="46" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="3" />
      <text x="100" y="116" textAnchor="middle" fontSize="52" fontWeight="700" fill="#fff" fillOpacity=".92" fontFamily="Inter, sans-serif">
        ฿
      </text>
      <ellipse cx="78" cy="68" rx="18" ry="9" fill="#fff" opacity=".35" transform="rotate(-30 78 68)" />
    </svg>
  );
}
