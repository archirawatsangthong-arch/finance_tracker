import { describe, expect, it } from 'vitest';
import { evaluate, tryEvaluate } from './calculator';
import { nthOccurrence } from './date';
import { parseCSV } from './backup';
import { parseNaturalInput } from './parser';
import { budgetLevel, goalPlan, percentChange, savingsRate, totals } from './stats';
import type { Category, Transaction } from '../types';

// หมวดหมู่ตัวอย่างสำหรับทดสอบ parser (ตรงกับหมวดเริ่มต้นในฐานข้อมูล)
const cat = (id: string, name: string, type: 'income' | 'expense', keywords: string[]): Category => ({ id, name, type, keywords, icon: 'tag', color: '#000000', order: 0, systemKey: null });
const CATEGORIES: Category[] = [
  cat('food', 'อาหาร', 'expense', ['กาแฟ', 'ข้าว', 'น้ำ']),
  cat('transport', 'เดินทาง', 'expense', ['grab', 'bts', 'ไฟ']),
  cat('shopping', 'ช้อปปิ้ง', 'expense', ['7-11', 'ซื้อ']),
  cat('bills', 'บิล/ค่าน้ำไฟ', 'expense', ['ค่าไฟ', 'ค่าเช่า']),
  cat('salary', 'เงินเดือน', 'income', ['เงินเดือน', 'โบนัส']),
  cat('freelance', 'ฟรีแลนซ์', 'income', ['ฟรีแลนซ์']),
];

describe('calculator', () => {
  it('respects operator precedence', () => {
    expect(evaluate('120+45*2')).toBe(210);
    expect(evaluate('(120+45)*2')).toBe(330);
    expect(evaluate('100÷4×3')).toBe(75);
    expect(evaluate('1,200−200')).toBe(1000);
  });
  it('returns null for invalid input', () => {
    expect(tryEvaluate('1+')).toBeNull();
    expect(tryEvaluate('5/0')).toBeNull();
    expect(tryEvaluate('abc')).toBeNull();
  });
});

describe('natural language parser', () => {
  const p = (s: string) => parseNaturalInput(s, CATEGORIES);
  it('parses expense with keyword', () => {
    expect(p('กาแฟ 65')).toMatchObject({ amount: 65, type: 'expense', categoryId: 'food', note: 'กาแฟ' });
  });
  it('parses income with + sign', () => {
    expect(p('เงินเดือน +35000')).toMatchObject({ amount: 35000, type: 'income', categoryId: 'salary' });
  });
  it('handles expressions, commas and k suffix', () => {
    expect(p('grab 120+45').amount).toBe(165);
    expect(p('ค่าเช่า 8,500').amount).toBe(8500);
    expect(p('ฟรีแลนซ์ 5k')).toMatchObject({ amount: 5000, type: 'income', categoryId: 'freelance' });
  });
  it('uses last number so "7-11" is not the amount', () => {
    expect(p('7-11 ซื้อน้ำ 25')).toMatchObject({ amount: 25, categoryId: 'shopping' });
  });
  it('prefers longest keyword', () => {
    expect(p('ค่าไฟ 1200').categoryId).toBe('bills');
  });
});

describe('stats', () => {
  const tx = (type: 'income' | 'expense', amount: number, date = '2026-01-10'): Transaction => ({
    id: Math.random().toString(), type, amount, date, categoryId: 'food', note: '', paymentMethod: 'cash', createdAt: '', recurringId: null,
  });
  it('computes totals and savings rate', () => {
    const t = totals([tx('income', 1000), tx('expense', 300), tx('expense', 100, '2026-02-01')], { start: '2026-01-01', end: '2026-01-31' });
    expect(t).toEqual({ income: 1000, expense: 300, net: 700 });
    expect(savingsRate(t)).toBe(70);
  });
  it('budget levels', () => {
    expect(budgetLevel(50)).toBe('safe');
    expect(budgetLevel(70)).toBe('warn');
    expect(budgetLevel(90)).toBe('warn');
    expect(budgetLevel(91)).toBe('danger');
  });
  it('percent change', () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(5, 0)).toBeNull();
  });
  it('goal plan per day', () => {
    const plan = goalPlan(10000, 4000, '2026-01-31', new Date('2026-01-01T00:00:00'));
    expect(plan.remaining).toBe(6000);
    expect(plan.daysLeft).toBe(30);
    expect(plan.perDay).toBe(200);
  });
});

describe('recurring', () => {
  it('monthly occurrences stay anchored (Jan 31 → Feb 28 → Mar 31)', () => {
    expect(nthOccurrence('2026-01-31', 'monthly', 1)).toBe('2026-02-28');
    expect(nthOccurrence('2026-01-31', 'monthly', 2)).toBe('2026-03-31');
  });
});

describe('csv', () => {
  it('parses quoted cells with commas and newlines', () => {
    const rows = parseCSV('date,note\r\n2026-01-01,"a, ""b""\nc"\n');
    expect(rows).toEqual([['date', 'note'], ['2026-01-01', 'a, "b"\nc']]);
  });
});
