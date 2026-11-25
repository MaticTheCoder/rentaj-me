// Enotski testi poslovne logike brez HTTP: pravila izposoje, obdelava napak in JWT.
// Bazo nadomestijo preprosti nadomestni objekti z enakimi metodami, kot jih kliče koda.
import { afterEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { neznanaPot, obdelajNapako } from '../src/middleware/napake.js';
import { preveriZeton, trajanjePiskotkaMs, ustvariZeton } from '../src/services/auth.js';
import { praviloZaVlogo, preveriSteviloKosov, preveriTrajanje } from '../src/services/pravila.js';
import { ApiError } from '../src/utils/ApiError.js';

const pravilo = { maxKosov: 3, maxDni: 7, maxDniDolgorocno: 180 };
const student = { id: 1, vloga: 'STUDENT' };
const profesor = { id: 2, vloga: 'PROFESOR' };

// Vrne napako, ki jo vrže fn, ali undefined.
function ujemiNapako(fn) {
  try {
    fn();
  } catch (napaka) {
    return napaka;
  }
  return undefined;
}

describe('preveriTrajanje', () => {
  it('dovoli izposojo, dolgo natanko maxDni', () => {
    expect(() =>
      preveriTrajanje(student, pravilo, { od: '2026-12-01', do: '2026-12-07', dolgorocna: false }),
    ).not.toThrow();
  });

  it('zavrne izposojo, daljšo od maxDni, s statusom 400', () => {
    const napaka = ujemiNapako(() =>
      preveriTrajanje(student, pravilo, { od: '2026-12-01', do: '2026-12-08', dolgorocna: false }),
    );
    expect(napaka).toBeInstanceOf(ApiError);
    expect(napaka.status).toBe(400);
    expect(napaka.message).toBe('Najdaljši čas izposoje za vašo vlogo je 7 dni');
  });

  it('študentu ne dovoli dolgoročne izposoje (403)', () => {
    const napaka = ujemiNapako(() =>
      preveriTrajanje(student, pravilo, { od: '2026-12-01', do: '2026-12-02', dolgorocna: true }),
    );
    expect(napaka.status).toBe(403);
  });

  it('profesorju pri dolgoročni izposoji dovoli do maxDniDolgorocno', () => {
    // 1. 12. 2026 + 179 dni = 29. 5. 2027 (180 dni z obema mejnima dnevoma).
    expect(() =>
      preveriTrajanje(profesor, pravilo, { od: '2026-12-01', do: '2027-05-29', dolgorocna: true }),
    ).not.toThrow();
  });

  it('profesorju zavrne dolgoročno izposojo, daljšo od 180 dni', () => {
    const napaka = ujemiNapako(() =>
      preveriTrajanje(profesor, pravilo, { od: '2026-12-01', do: '2027-05-30', dolgorocna: true }),
    );
    expect(napaka.status).toBe(400);
    expect(napaka.message).toBe('Najdaljši čas dolgoročne izposoje je 180 dni');
  });

  it('brez maxDniDolgorocno velja za dolgoročno izposojo maxDni', () => {
    const brezDolgorocne = { ...pravilo, maxDniDolgorocno: null };
    const napaka = ujemiNapako(() =>
      preveriTrajanje(profesor, brezDolgorocne, {
        od: '2026-12-01',
        do: '2026-12-08',
        dolgorocna: true,
      }),
    );
    expect(napaka.message).toBe('Najdaljši čas dolgoročne izposoje je 7 dni');
  });
});

describe('preveriSteviloKosov', () => {
  const bazaZAktivnimi = (aktivnih) => ({
    postavkaRezervacije: { count: vi.fn().mockResolvedValue(aktivnih) },
  });

  it('dovoli oddajo, ko aktivni in novi kosi skupaj ne presežejo meje', async () => {
    await expect(preveriSteviloKosov(bazaZAktivnimi(1), student, pravilo, 2)).resolves.toBe(
      undefined,
    );
  });

  it('zavrne oddajo, ki bi presegla maxKosov, in navede število aktivnih kosov', async () => {
    await expect(preveriSteviloKosov(bazaZAktivnimi(2), student, pravilo, 2)).rejects.toMatchObject(
      {
        status: 400,
        message: 'Presežena omejitev: imate 2 aktivnih kosov, dovoljenih je 3.',
      },
    );
  });

  it('šteje le kose uporabnika v aktivnih rezervacijah', async () => {
    const baza = bazaZAktivnimi(0);
    await preveriSteviloKosov(baza, student, pravilo, 1);
    expect(baza.postavkaRezervacije.count).toHaveBeenCalledWith({
      where: {
        rezervacija: { uporabnikId: 1, status: { in: ['ODDANA', 'ODOBRENA', 'IZDANA'] } },
      },
    });
  });
});

describe('praviloZaVlogo', () => {
  it('vrne pravilo za vlogo iz baze', async () => {
    const baza = { praviloIzposoje: { findUnique: vi.fn().mockResolvedValue(pravilo) } };
    await expect(praviloZaVlogo(baza, 'STUDENT')).resolves.toBe(pravilo);
    expect(baza.praviloIzposoje.findUnique).toHaveBeenCalledWith({ where: { vloga: 'STUDENT' } });
  });

  it('za vlogo brez pravila vrže 403', async () => {
    const baza = { praviloIzposoje: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(praviloZaVlogo(baza, 'TEHNIK')).rejects.toMatchObject({ status: 403 });
  });
});

describe('obdelava napak', () => {
  const odgovor = () => {
    const res = {};
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    return res;
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('neznana pot posreduje ApiError 404', () => {
    const next = vi.fn();
    neznanaPot({}, {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 404, message: 'Pot ne obstaja.' });
  });

  it('ApiError pretvori v odgovor z njenim statusom in sporočilom', () => {
    const res = odgovor();
    obdelajNapako(new ApiError(409, 'Konflikt.'), {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ sporocilo: 'Konflikt.' });
  });

  it('pokvarjen JSON v telesu zahteve vrne 400', () => {
    const res = odgovor();
    obdelajNapako({ type: 'entity.parse.failed' }, {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('neznana napaka vrne 500 brez podrobnosti za uporabnika', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = odgovor();
    obdelajNapako(new Error('geslo baze: skrivnost'), {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ sporocilo: 'Prišlo je do napake na strežniku.' });
    expect(console.error).toHaveBeenCalled();
  });
});

describe('JWT', () => {
  it('žeton vsebuje ID uporabnika in vlogo', () => {
    const vsebina = preveriZeton(ustvariZeton({ id: 7, vloga: 'TEHNIK' }));
    expect(vsebina.sub).toBe('7');
    expect(vsebina.vloga).toBe('TEHNIK');
  });

  it('žeton poteče hkrati s piškotkom', () => {
    const vsebina = preveriZeton(ustvariZeton({ id: 7, vloga: 'TEHNIK' }));
    expect((vsebina.exp - vsebina.iat) * 1000).toBe(trajanjePiskotkaMs);
  });

  it('zavrne žeton, podpisan z drugo skrivnostjo', () => {
    const ponarejen = jwt.sign({ vloga: 'ADMIN' }, 'napacna-skrivnost', { subject: '1' });
    expect(() => preveriZeton(ponarejen)).toThrow();
  });

  it('zavrne nepodpisan žeton (alg none)', () => {
    const nepodpisan = jwt.sign({ vloga: 'ADMIN' }, null, { algorithm: 'none', subject: '1' });
    expect(() => preveriZeton(nepodpisan)).toThrow();
  });
});
