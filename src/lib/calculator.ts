// เครื่องคิดเลขแบบปลอดภัย (ไม่ใช้ eval) รองรับ + − × ÷ วงเล็บ และลำดับความสำคัญของตัวดำเนินการ
// ตัวอย่าง: evaluate("120+45*2") === 210

type Token = { kind: 'num'; value: number } | { kind: 'op'; value: string };

function tokenize(input: string): Token[] {
  const src = input.replace(/[×xX]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/,/g, '').replace(/\s+/g, '');
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const n = Number(src.slice(i, j));
      if (Number.isNaN(n)) throw new Error('ตัวเลขไม่ถูกต้อง');
      tokens.push({ kind: 'num', value: n });
      i = j;
    } else if ('+-*/()%'.includes(ch)) {
      tokens.push({ kind: 'op', value: ch });
      i++;
    } else {
      throw new Error(`อักขระไม่รองรับ: ${ch}`);
    }
  }
  return tokens;
}

/** Recursive-descent parser: expr := term (('+'|'-') term)* ; term := factor (('*'|'/') factor)* */
export function evaluate(input: string): number {
  const tokens = tokenize(input);
  let pos = 0;
  const peek = () => tokens[pos];

  const factor = (): number => {
    const t = tokens[pos++];
    if (!t) throw new Error('นิพจน์ไม่สมบูรณ์');
    if (t.kind === 'num') {
      if (peek()?.kind === 'op' && peek().value === '%') {
        pos++;
        return t.value / 100;
      }
      return t.value;
    }
    if (t.value === '-') return -factor();
    if (t.value === '+') return factor();
    if (t.value === '(') {
      const v = expr();
      if (tokens[pos++]?.value !== ')') throw new Error('วงเล็บไม่ครบ');
      return v;
    }
    throw new Error('นิพจน์ไม่ถูกต้อง');
  };

  const term = (): number => {
    let v = factor();
    while (peek()?.kind === 'op' && (peek().value === '*' || peek().value === '/')) {
      const op = tokens[pos++].value;
      const r = factor();
      if (op === '/' && r === 0) throw new Error('หารด้วยศูนย์ไม่ได้');
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };

  const expr = (): number => {
    let v = term();
    while (peek()?.kind === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = tokens[pos++].value;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };

  if (tokens.length === 0) return 0;
  const result = expr();
  if (pos !== tokens.length) throw new Error('นิพจน์ไม่ถูกต้อง');
  return Math.round(result * 100) / 100;
}

/** คืนค่า null แทนการ throw — สะดวกสำหรับแสดงผลลัพธ์สด */
export function tryEvaluate(input: string): number | null {
  try {
    const v = evaluate(input);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}
