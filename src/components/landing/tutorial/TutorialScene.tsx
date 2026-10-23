import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { createContext, useContext, useEffect, useMemo, useRef, type ComponentProps, type ReactNode } from 'react';
import * as THREE from 'three';
import { Coin, getCoinMaterials } from '../../three/Coin';
import LandingCanvas from '../LandingCanvas';
import { CategoryBox, Lock, Phone } from '../models/Props3D';
import { PIGGY_SLOT, Piggy } from '../models/Piggy';
import { useSceneQuality } from '../quality';
import { flyK, flyLocal, flyState, smooth, stepLocal, stepWeight, tutorialProgress } from './progress';

// ===== ฉาก 3D ของ Tutorial: ทุกขั้นอยู่ในฉากเดียว ขยับตาม progress ที่ lerp เข้าหาค่าจากการ scroll =====

const CATS = [
  { name: 'อาหาร', color: '#F59E0B' },
  { name: 'เดินทาง', color: '#3B82F6' },
  { name: 'บิล', color: '#06B6D4' },
  { name: 'บันเทิง', color: '#8B5CF6' },
  { name: 'ช้อปปิ้ง', color: '#EC4899' },
];
// สัดส่วนโดนัท (ผลรวม = 1)
const SHARES = [0.32, 0.18, 0.24, 0.14, 0.12];
const BARS = [0.55, 0.8, 0.45, 1, 0.7, 0.9];

const v = new THREE.Vector3();

/** ตัวช่วย: ทำให้ group ค่อย ๆ ปรากฏ (scale) ตามน้ำหนักของขั้น และซ่อนเมื่อ ~0 เพื่อไม่เสียเวลา render */
function useStepGroup(step: number, extra?: (g: THREE.Group, w: number, p: number, t: number) => void) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const p = sharedP.value;
    const w = smooth(stepWeight(p, step));
    g.visible = w > 0.01;
    if (!g.visible) return;
    // ขั้นที่กำลังจางหายจะหดเล็กลงชัดเจน ไม่ซ้อนทับขั้นปัจจุบัน
    g.scale.setScalar(0.25 + w * 0.75);
    extra?.(g, w, p, clock.elapsedTime);
  });
  return ref;
}

/** progress ที่ lerp แล้ว (คำนวณครั้งเดียวต่อเฟรมใน <Driver />) */
const sharedP = { value: 0 };

function Driver() {
  useFrame((_, delta) => {
    // lerp แบบไม่ขึ้นกับ fps: ยิ่ง delta มาก ยิ่งเข้าใกล้เป้ามาก
    sharedP.value = THREE.MathUtils.damp(sharedP.value, tutorialProgress.target, 5, Math.min(delta, 0.05));
  });
  return null;
}

/**
 * <Html> ที่ portal เข้า container ของ canvas เสมอ
 * (Canvas ตั้ง eventSource เป็น #root ทำให้ Html ค่าเริ่มต้นไปแปะที่มุมบนของหน้าแทนที่จะอยู่บนฉาก)
 */
function SceneHtml({ children, ...props }: ComponentProps<typeof Html>) {
  const gl = useThree((s) => s.gl);
  const portal = useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
  const step = useContext(StepContext);
  const wrap = useRef<HTMLDivElement>(null);
  // Html ไม่ซ่อนตาม visible/scale ของ group แม่ → จาง/ย่อ/ซ่อน DOM เองตามน้ำหนักของขั้น ไม่ให้ป้ายของขั้นอื่นค้างซ้อนกัน
  useFrame(() => {
    const el = wrap.current;
    if (!el || step === null) return;
    // จางเร็วกว่าตัวโมเดล: ช่วงกลางการเปลี่ยนขั้น (w ≈ 0.5) ป้ายของทั้งสองขั้นแทบหายหมด จึงไม่ซ้อนกัน
    const w = smooth(Math.min(1, Math.max(0, (smooth(stepWeight(sharedP.value, step)) - 0.55) / 0.45)));
    if (w <= 0.01) {
      if (el.style.display !== 'none') el.style.display = 'none';
      return;
    }
    el.style.display = '';
    el.style.opacity = w.toFixed(3);
    el.style.transform = `scale(${(0.85 + w * 0.15).toFixed(3)})`;
  });
  return (
    <Html portal={portal} {...props}>
      <div ref={wrap} style={step === null ? undefined : { display: 'none' }}>
        {children}
      </div>
    </Html>
  );
}

/** หมายเลขขั้นของ subtree นี้ — ให้ SceneHtml รู้ว่าต้องแสดงตอนไหน */
const StepContext = createContext<number | null>(null);

/** label ลอยในฉาก (HTML) — ซ่อนจาก screen reader เพราะเนื้อหาเดียวกันอยู่ในข้อความฝั่งซ้ายแล้ว */
function Tag({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div aria-hidden className={`pointer-events-none select-none whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold backdrop-blur-md ${className}`}>{children}</div>;
}

// ---------- วัตถุ "หยอดลงกระปุก": เหรียญ + ป้ายตัวเลข พุ่งจากนอกฉากเข้าช่องหยอด แล้วย่อ/จางหาย (ผูกกับ scroll) ----------

interface FlyItem {
  /** จุดเริ่ม (นอกขอบฉากเล็กน้อย) ในพิกัดของ group ขั้นนั้น */
  from: THREE.Vector3Tuple;
  label: string;
  /** สไตล์ป้ายแบบ glass ตามสีรายรับ/รายจ่าย */
  className: string;
  tint?: string;
  /** หน่วงใน flyLocal (0..1-FLY_SPAN) → หยอดทีละชิ้นตามการเลื่อน */
  delay: number;
}

const INCOME_TAG = 'bg-income/15 text-income ring-1 ring-income/40 shadow-[0_0_24px_-8px] shadow-income';
const EXPENSE_TAG = 'bg-expense/15 text-expense ring-1 ring-expense/40 shadow-[0_0_24px_-8px] shadow-expense';

/** สถานะของวัตถุชิ้นหนึ่ง ณ progress p */
const itemState = (p: number, step: number, it: FlyItem) => flyState(flyK(flyLocal(p, step), it.delay));

/** กระปุก "อึก" เล็กน้อยตอนมีของจมลงช่อง (0..1) */
const gulp = (p: number, step: number, items: FlyItem[]) => items.reduce((m, it) => Math.max(m, Math.sin(Math.PI * itemState(p, step, it).sink)), 0);

function FlyIn({ item, to, step, coinScale = 0.26 }: { item: FlyItem; to: THREE.Vector3Tuple; step: number; coinScale?: number }) {
  const root = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const tag = useRef<HTMLDivElement>(null);
  // material เฉพาะเหรียญนี้ เพื่อจาง opacity ได้โดยไม่กระทบเหรียญอื่นที่ใช้ material ร่วม
  const mats = useMemo(
    () =>
      getCoinMaterials(item.tint).map((m) => {
        const c = m.clone();
        c.transparent = true;
        return c;
      }),
    [item.tint],
  );
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const p = sharedP.value;
    const s = itemState(p, step, item);
    const opacity = s.opacity * smooth(stepWeight(p, step));
    g.visible = opacity > 0.01;
    // Html ไม่ซ่อนตาม visible ของ group และไม่ย่อตาม scale → ปรับ DOM เอง
    if (tag.current) {
      // น้ำหนักของขั้นจัดการโดย SceneHtml แล้ว ใช้แค่ opacity ของตัววัตถุ
      tag.current.style.opacity = g.visible ? s.opacity.toFixed(3) : '0';
      tag.current.style.transform = `scale(${s.scale.toFixed(3)})`;
    }
    if (!g.visible) return;
    // เส้นโค้ง bezier: ยกตัวขึ้นเหนือกระปุกก่อน แล้วโฉบลงช่องหยอดจากด้านบน
    const [ax, ay, az] = item.from;
    const [bx, by, bz] = to;
    const cx = THREE.MathUtils.lerp(ax, bx, 0.65);
    const cy = Math.max(ay, by) + 0.9;
    const cz = THREE.MathUtils.lerp(az, bz, 0.5);
    const t = s.travel;
    const u = 1 - t;
    g.position.set(u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by - s.sink * 0.35, u * u * az + 2 * u * t * cz + t * t * bz);
    g.scale.setScalar(Math.max(0.001, s.scale));
    // หมุนระหว่างบิน แล้วตั้งสันตรงแนวช่องหยอด (ระนาบ xy) พอดีตอนถึง
    spin.current?.rotation.set(u * (Math.PI * 4 + item.delay * 9), u * Math.PI * 2, 0);
    for (const m of mats) m.opacity = opacity;
  });

  return (
    <group ref={root}>
      <group ref={spin} scale={coinScale}>
        <Coin segments={32} materials={mats} />
      </group>
      <SceneHtml center position={[0, coinScale + 0.28, 0]} distanceFactor={7}>
        <div ref={tag} style={{ opacity: 0 }}>
          <Tag className={item.className}>{item.label}</Tag>
        </div>
      </SceneHtml>
    </group>
  );
}

/** ตำแหน่งช่องหยอดของกระปุกที่วางไว้ที่ position/scale นี้ */
const slotOf = (pos: THREE.Vector3Tuple, scale: number): THREE.Vector3Tuple => [pos[0] + PIGGY_SLOT[0] * scale, pos[1] + PIGGY_SLOT[1] * scale, pos[2] + PIGGY_SLOT[2] * scale];

// ---------- ขั้น 1: แม่กุญแจหมุนแล้วปลดล็อก ----------
function StepLock() {
  const shackle = useRef<THREE.Group>(null);
  const ref = useStepGroup(0, (g, _w, p, t) => {
    const local = smooth(stepLocal(p, 0));
    g.rotation.y = Math.sin(t * 0.6) * 0.25 + local * Math.PI * 2;
    if (shackle.current) {
      // ปลดล็อก: ห่วงยกขึ้นและหมุนออก
      const u = smooth(Math.min(1, Math.max(0, (local - 0.45) / 0.4)));
      shackle.current.position.y = 0.6 + u * 0.35;
      shackle.current.rotation.y = u * 1.2;
    }
  });
  return (
    <group ref={ref}>
      <Lock shackleRef={shackle} />
    </group>
  );
}

// ---------- ขั้น 2: มือถือพิมพ์รายการ → ป้ายตัวเลขพุ่งหยอดลงกระปุกข้าง ๆ ----------
const RECORD_PHONE: THREE.Vector3Tuple = [-0.95, -0.1, 0];
const RECORD_PIGGY: THREE.Vector3Tuple = [1.05, -0.4, 0];
const RECORD_PIGGY_SCALE = 0.55;
const RECORD_ITEMS: FlyItem[] = [
  { from: [-2.7, 2.3, 1], label: '+฿35,000', className: INCOME_TAG, tint: '#34D399', delay: 0 },
  // หยอดหลังพิมพ์ "กาแฟ 65" เสร็จ (typing จบที่ flyLocal ≈ 0.4)
  { from: [2.8, 2.4, 0.8], label: 'กาแฟ -฿65', className: EXPENSE_TAG, tint: '#F87171', delay: 0.45 },
];

function StepRecord() {
  const piggy = useRef<THREE.Group>(null);
  const typed = useRef<HTMLSpanElement>(null);
  const cat = useRef<HTMLDivElement>(null);
  const to = slotOf(RECORD_PIGGY, RECORD_PIGGY_SCALE);
  const ref = useStepGroup(1, (g, _w, p, t) => {
    g.rotation.y = -0.2 + Math.sin(t * 0.7) * 0.1;
    g.position.y = Math.sin(t * 1.2) * 0.06;
    piggy.current?.scale.setScalar(RECORD_PIGGY_SCALE * (1 + 0.07 * gulp(p, 1, RECORD_ITEMS)));
    // typing "กาแฟ 65" ตาม progress ภายในขั้น
    const text = 'กาแฟ 65';
    const n = Math.round(smooth(Math.min(1, stepLocal(p, 1) * 1.6)) * text.length);
    if (typed.current && typed.current.textContent !== text.slice(0, n)) typed.current.textContent = text.slice(0, n);
    if (cat.current) cat.current.style.opacity = n >= text.length ? '1' : '0';
  });
  return (
    <group ref={ref}>
      <group position={RECORD_PHONE} scale={0.85}>
        <Phone />
      </group>
      <group ref={piggy} position={RECORD_PIGGY} scale={RECORD_PIGGY_SCALE} rotation={[0, -0.4, 0]}>
        <Piggy />
      </group>
      {RECORD_ITEMS.map((it) => (
        <FlyIn key={it.label} item={it} to={to} step={1} />
      ))}
      {/* ช่องพิมพ์บนหน้าจอมือถือ */}
      <SceneHtml center position={[RECORD_PHONE[0], -0.55, 0.12]} distanceFactor={6} transform={false}>
        <div aria-hidden className="pointer-events-none flex w-44 flex-col items-center gap-2">
          <div className="w-full rounded-xl border border-accent/50 bg-[#0f0b24]/90 px-3 py-2 text-sm text-white shadow-[0_0_24px_-6px] shadow-accent">
            <span ref={typed} />
            <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-accent-soft" />
          </div>
          <div ref={cat} className="flex items-center gap-1.5 rounded-full bg-[#F59E0B]/20 px-2.5 py-1 text-xs font-medium text-[#FCD34D] opacity-0 ring-1 ring-[#F59E0B]/40 transition-opacity duration-300">
            🍜 หมวด: อาหาร
          </div>
        </div>
      </SceneHtml>
    </group>
  );
}

// ---------- ขั้น 3: เหรียญแยกเข้ากล่องตามหมวด ----------
function StepCategorize({ coinsPerBox }: { coinsPerBox: number }) {
  const coins = useRef<(THREE.Group | null)[]>([]);
  const items = useMemo(
    () => CATS.flatMap((c, ci) => Array.from({ length: coinsPerBox }, (_, k) => ({ ci, k, color: c.color, seed: ci * 7 + k * 3 }))),
    [coinsPerBox],
  );
  const boxX = (ci: number) => (ci - 2) * 1.05;
  const ref = useStepGroup(2, (g, _w, p, t) => {
    g.rotation.x = 0.35;
    g.rotation.y = Math.sin(t * 0.4) * 0.12;
    const local = smooth(stepLocal(p, 2));
    items.forEach((it, i) => {
      const c = coins.current[i];
      if (!c) return;
      // เริ่มจากกองรวมกลางฉาก แล้วบินเข้ากล่องของหมวดตัวเอง (หน่วงเวลาไม่เท่ากันให้ดูเป็นธรรมชาติ)
      const delay = (it.seed % 9) / 30;
      const k = smooth(Math.min(1, Math.max(0, (local - delay) / 0.7)));
      const sx = Math.sin(it.seed * 12.9) * 0.6;
      const sy = 1.6 + Math.cos(it.seed * 4.1) * 0.35;
      const tx = boxX(it.ci) + (it.k - (coinsPerBox - 1) / 2) * 0.12;
      const ty = -0.25 + it.k * 0.09;
      v.set(THREE.MathUtils.lerp(sx, tx, k), THREE.MathUtils.lerp(sy, ty, k) + Math.sin(k * Math.PI) * 0.7, Math.cos(it.seed) * 0.2 * (1 - k));
      c.position.copy(v);
      c.rotation.set(THREE.MathUtils.lerp(t * 2 + it.seed, Math.PI / 2, k), THREE.MathUtils.lerp(t + it.seed, 0, k), 0);
    });
  });
  return (
    <group ref={ref}>
      {CATS.map((c, ci) => (
        <group key={c.name} position={[boxX(ci), -0.3, 0]}>
          <CategoryBox color={c.color} />
          <SceneHtml center position={[0, -0.75, 0.4]} distanceFactor={7}>
            <Tag className="bg-black/40 text-xs text-white/90 ring-1 ring-white/15">
              <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
              {c.name}
            </Tag>
          </SceneHtml>
        </group>
      ))}
      {items.map((it, i) => (
        <group key={i} ref={(el) => void (coins.current[i] = el)} scale={0.2}>
          <Coin segments={20} tint={it.color} />
        </group>
      ))}
    </group>
  );
}

// ---------- ขั้น 4: เหรียญเรียงเป็นโดนัท + กราฟแท่ง ----------
function StepInsight({ perSlice }: { perSlice: number }) {
  const coins = useRef<(THREE.Group | null)[]>([]);
  const bars = useRef<(THREE.Mesh | null)[]>([]);
  const slots = useMemo(() => {
    // แจกเหรียญลงแต่ละ slice ตามสัดส่วน แล้ววางเรียงรอบวง
    const total = perSlice * CATS.length;
    const out: { angle: number; color: string; seed: number }[] = [];
    let acc = 0;
    SHARES.forEach((share, si) => {
      const n = Math.max(2, Math.round(share * total));
      for (let k = 0; k < n; k++) out.push({ angle: (acc + (share * (k + 0.5)) / n) * Math.PI * 2, color: CATS[si].color, seed: si * 11 + k });
      acc += share;
    });
    return out;
  }, [perSlice]);
  const ref = useStepGroup(3, (g, _w, p, t) => {
    const local = smooth(stepLocal(p, 3));
    g.rotation.y = Math.sin(t * 0.3) * 0.15;
    slots.forEach((s, i) => {
      const c = coins.current[i];
      if (!c) return;
      const k = smooth(Math.min(1, Math.max(0, local * 1.3 - (s.seed % 7) / 25)));
      // เหรียญตั้งสันเรียงรอบวงในระนาบของจาน (plate) → แต่ละเหรียญเป็นหน้าตัดของโดนัท รวมกันเป็นวงหนา ๆ
      const a = s.angle + t * 0.25;
      const r = 1;
      // จุดเริ่ม: กระจายอยู่เหนือวง (พิกัดในระนาบจาน)
      const sx = Math.sin(s.seed * 3.7) * 1.6;
      const sy = 1.4 + Math.cos(s.seed) * 0.5;
      c.position.set(THREE.MathUtils.lerp(sx, Math.cos(a) * r, k), THREE.MathUtils.lerp(sy, Math.sin(a) * r, k), THREE.MathUtils.lerp(1.2, 0, k));
      // หมุนให้หน้าเหรียญ (+z) ชี้ไปตามแนวสัมผัสวง: Rx(-90°) ก่อน แล้ว Rz(a)
      c.rotation.set(THREE.MathUtils.lerp(t * 2 + s.seed, -Math.PI / 2, k), 0, THREE.MathUtils.lerp(s.seed, a, k), 'ZYX');
    });
    bars.current.forEach((b, i) => {
      if (!b) return;
      const k = smooth(Math.min(1, Math.max(0, local * 1.4 - i * 0.08)));
      const h = Math.max(0.001, BARS[i] * 1.5 * k);
      b.scale.y = h;
      b.position.y = -1.05 + h / 2;
    });
  });
  return (
    <group ref={ref}>
      {slots.map((s, i) => (
        <group key={i} ref={(el) => void (coins.current[i] = el)} scale={0.17}>
          <Coin segments={20} tint={s.color} />
        </group>
      ))}
      <SceneHtml center position={[-0.8, 0.25, 0]} distanceFactor={7}>
        <div aria-hidden className="pointer-events-none select-none whitespace-nowrap text-center">
          <p className="text-[10px] text-white/60">อัตราการออม</p>
          <p className="text-lg font-bold text-income">32%</p>
        </div>
      </SceneHtml>
      {/* กราฟแท่งชิดขวาแต่ไม่ล้นขอบฉาก (โดนัทซ้ายกว้าง ~±1.85, กราฟขวาถึง ~1.9) */}
      <group position={[1.2, 0, 0]}>
        {BARS.map((_, i) => (
          <mesh key={i} ref={(el) => void (bars.current[i] = el)} position={[(i - 2.5) * 0.22, -1, 0]}>
            <boxGeometry args={[0.17, 1, 0.17]} />
            <meshStandardMaterial color={i % 2 ? '#F87171' : '#34D399'} emissive={i % 2 ? '#F87171' : '#34D399'} emissiveIntensity={0.55} metalness={0.3} roughness={0.3} />
          </mesh>
        ))}
        <mesh position={[0, -1.06, 0]}>
          <boxGeometry args={[1.45, 0.02, 0.3]} />
          <meshStandardMaterial color="#a78bfa" emissive="#8b5cf6" emissiveIntensity={0.4} />
        </mesh>
      </group>
    </group>
  );
}

// ---------- ขั้น 5: หยอดเงินเข้าเป้าหมายทีละก้อน → กระปุกเต็ม + progress ring เรืองแสง ----------
const GOAL_PIGGY_SCALE = 0.85;
// มาจากทั้ง 4 มุมนอกฉาก ไม่ทับเส้นทางกัน
const GOAL_ITEMS: FlyItem[] = [
  { from: [-2.7, 2.2, 1], label: '+฿5,000', className: INCOME_TAG, delay: 0 },
  { from: [2.7, 2.0, 0.8], label: '+฿12,000', className: INCOME_TAG, delay: 0.15 },
  { from: [-2.5, -0.8, 1.4], label: '+฿8,000', className: INCOME_TAG, delay: 0.3 },
  { from: [2.6, -0.6, 1.2], label: '+฿25,000', className: INCOME_TAG, delay: 0.45 },
];

function StepGoals() {
  const piggy = useRef<THREE.Group>(null);
  const fill = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const label = useRef<HTMLSpanElement>(null);
  const ringGeo = useMemo(() => new THREE.TorusGeometry(1.95, 0.05, 12, 128, Math.PI * 2), []);
  const to = slotOf([0, 0, 0], GOAL_PIGGY_SCALE);
  const ref = useStepGroup(4, (g, _w, p, t) => {
    // ความคืบหน้าของเป้าหมาย = สัดส่วนเงินที่ "จม" ลงกระปุกแล้ว → เปอร์เซ็นต์ขึ้นทีละก้อนตามการ scroll
    const local = GOAL_ITEMS.reduce((sum, it) => sum + itemState(p, 4, it).sink, 0) / GOAL_ITEMS.length;
    g.rotation.y = -0.35 + Math.sin(t * 0.5) * 0.15;
    piggy.current?.scale.setScalar(GOAL_PIGGY_SCALE * (1 + 0.05 * gulp(p, 4, GOAL_ITEMS)));
    if (fill.current) fill.current.scale.y = 0.15 + local * 0.85;
    if (ring.current) {
      // วาดวงแหวนเท่ากับเปอร์เซ็นต์ (drawRange ของ index buffer)
      const idx = ring.current.geometry.index;
      if (idx) ring.current.geometry.setDrawRange(0, Math.floor(idx.count * Math.max(0.02, local) / 6) * 6);
      ring.current.rotation.z = Math.PI / 2;
    }
    const pct = `${Math.round(local * 100)}%`;
    if (label.current && label.current.textContent !== pct) label.current.textContent = pct;
  });
  return (
    <group ref={ref}>
      <group ref={piggy} scale={GOAL_PIGGY_SCALE}>
        <Piggy fillRef={fill} />
      </group>
      {GOAL_ITEMS.map((it) => (
        <FlyIn key={it.label} item={it} to={to} step={4} coinScale={0.24} />
      ))}
      <mesh ref={ring} geometry={ringGeo} position={[0, 0, -0.6]}>
        <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.62]}>
        <torusGeometry args={[1.95, 0.035, 8, 96]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.08} />
      </mesh>
      <SceneHtml center position={[0, -1.55, 0.6]} distanceFactor={7}>
        <Tag className="bg-black/40 text-white ring-1 ring-income/40">
          เที่ยวญี่ปุ่น <span ref={label} className="text-income">0%</span>
        </Tag>
      </SceneHtml>
    </group>
  );
}

/** ทั้งฉาก tutorial — ขยับกล้อง/ตำแหน่งตามเมาส์เล็กน้อย */
function Stage() {
  const root = useRef<THREE.Group>(null);
  const q = useSceneQuality();
  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, state.pointer.x * 0.18, 3, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -state.pointer.y * 0.1, 3, dt);
  });
  return (
    <group ref={root}>
      <Driver />
      <StepContext.Provider value={0}>
        <StepLock />
      </StepContext.Provider>
      <StepContext.Provider value={1}>
        <StepRecord />
      </StepContext.Provider>
      <StepContext.Provider value={2}>
        <StepCategorize coinsPerBox={q.mobile ? 3 : 5} />
      </StepContext.Provider>
      <StepContext.Provider value={3}>
        <StepInsight perSlice={q.mobile ? 4 : 7} />
      </StepContext.Provider>
      <StepContext.Provider value={4}>
        <StepGoals />
      </StepContext.Provider>
    </group>
  );
}

export default function TutorialScene({ paused }: { paused: boolean }) {
  return (
    <LandingCanvas paused={paused} camera={{ position: [0, 0.2, 7], fov: 40 }} bloom={0.5}>
      <Stage />
    </LandingCanvas>
  );
}
