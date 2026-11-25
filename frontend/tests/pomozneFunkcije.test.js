// Enotski testi pomožnih funkcij: slovenske oblike po številu, meseci koledarja in izbira termina.
import { describe, expect, it } from 'vitest';
import { danVTednu, dodajMesece, zadnjiDanMeseca } from '../src/utils/datumi.js';
import { poStevilu, steviloDniBesedilo, steviloKosovBesedilo } from '../src/utils/oznake.js';
import { izberiDanVTerminu } from '../src/utils/termin.js';

describe('slovenske oblike po številu', () => {
  it('dnevi: ednina, dvojina, 3–4 in 5+', () => {
    expect(steviloDniBesedilo(1)).toBe('1 dan');
    expect(steviloDniBesedilo(2)).toBe('2 dneva');
    expect(steviloDniBesedilo(4)).toBe('4 dnevi');
    expect(steviloDniBesedilo(5)).toBe('5 dni');
  });

  it('pri dnevih odloča ostanek pri 100 (101 dan, 111 dni)', () => {
    expect(steviloDniBesedilo(101)).toBe('101 dan');
    expect(steviloDniBesedilo(102)).toBe('102 dneva');
    expect(steviloDniBesedilo(111)).toBe('111 dni');
  });

  it('kosi: 1 kos, 2 kosa, 3 kosi, 0 kosov', () => {
    expect(steviloKosovBesedilo(1)).toBe('1 kos');
    expect(steviloKosovBesedilo(2)).toBe('2 kosa');
    expect(steviloKosovBesedilo(3)).toBe('3 kosi');
    expect(steviloKosovBesedilo(0)).toBe('0 kosov');
  });

  it('poStevilu uporabi podane oblike', () => {
    const oblike = ['poškodbo', 'poškodbi', 'poškodbe', 'poškodb'];
    expect(poStevilu(1, oblike)).toBe('1 poškodbo');
    expect(poStevilu(2, oblike)).toBe('2 poškodbi');
    expect(poStevilu(3, oblike)).toBe('3 poškodbe');
    expect(poStevilu(12, oblike)).toBe('12 poškodb');
  });
});

describe('meseci koledarja', () => {
  it('zadnji dan meseca upošteva prestopna leta', () => {
    expect(zadnjiDanMeseca('2028-02')).toBe('2028-02-29');
    expect(zadnjiDanMeseca('2027-02')).toBe('2027-02-28');
    expect(zadnjiDanMeseca('2026-11')).toBe('2026-11-30');
  });

  it('premik med meseci prestopi mejo leta v obe smeri', () => {
    expect(dodajMesece('2026-12', 1)).toBe('2027-01');
    expect(dodajMesece('2026-01', -1)).toBe('2025-12');
    expect(dodajMesece('2026-11', 14)).toBe('2028-01');
  });

  it('teden se začne s ponedeljkom', () => {
    expect(danVTednu('2026-11-23')).toBe(0); // ponedeljek
    expect(danVTednu('2026-11-29')).toBe(6); // nedelja
  });
});

describe('izbira termina v koledarju', () => {
  it('prvi klik nastavi prvi dan', () => {
    expect(izberiDanVTerminu({ od: '', do: '' }, '2026-12-03')).toEqual({
      od: '2026-12-03',
      do: '',
    });
  });

  it('drugi klik nastavi zadnji dan', () => {
    expect(izberiDanVTerminu({ od: '2026-12-03', do: '' }, '2026-12-05')).toEqual({
      od: '2026-12-03',
      do: '2026-12-05',
    });
  });

  it('klik pred prvim dnevom začne izbiro znova', () => {
    expect(izberiDanVTerminu({ od: '2026-12-03', do: '' }, '2026-12-01')).toEqual({
      od: '2026-12-01',
      do: '',
    });
  });

  it('klik po že izbranem terminu začne izbiro znova', () => {
    expect(izberiDanVTerminu({ od: '2026-12-03', do: '2026-12-05' }, '2026-12-10')).toEqual({
      od: '2026-12-10',
      do: '',
    });
  });
});
