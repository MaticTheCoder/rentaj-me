# Rentaj.me

[![CI/CD](https://github.com/MaticTheCoder/rentaj-me/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/MaticTheCoder/rentaj-me/actions/workflows/ci-cd.yml)

**Nameščena aplikacija:** <NAMESCENA_APLIKACIJA> (prijava s [testnimi računi](#testni-računi))

Spletni sistem za izposojo opreme na oddelku za tehniko.

Študenti, asistenti in profesorji v katalogu poiščejo opremo (mikrokrmilnike, senzorje, merilne instrumente, kamere, VR očala, 3D tiskalnike …), preverijo njeno zasedenost in oddajo rezervacijo. Tehnik oddelka rezervacije odobrava, opremo izdaja in prevzema ter beleži njeno stanje in morebitne poškodbe. Sistem samodejno prikaže zamujena vračila, administrator pa upravlja uporabnike, kategorije opreme in pravila izposoje.

## Tehnologije

| Področje | Tehnologije |
|---|---|
| **Frontend** | React, Vite, React Router, Tailwind CSS |
| **Backend** | Node.js, Express, Zod |
| **Podatkovna baza** | PostgreSQL, Prisma ORM |
| **Avtentikacija** | JWT v piškotku httpOnly, bcrypt |
| **Lokalni razvoj** | Docker, Docker Compose |
| **Testi in CI** | Vitest, Supertest, ESLint, Prettier, GitHub Actions |

## Struktura repozitorija

```
├── frontend/   # React aplikacija
├── backend/    # Express REST API
├── .github/    # CI/CD (GitHub Actions)
└── docs/       # dokumentacija projekta
```

## Lokalni zagon

Potrebuješ [Git](https://git-scm.com/) in [Docker](https://docs.docker.com/get-docker/) z Docker Compose. Node.js na računalniku ni potreben.

1. Prenesi repozitorij:

   ```bash
   git clone https://github.com/Topolinjak/rentaj-me.git
   cd rentaj-me
   ```

2. Kopiraj predlogo nastavitev in jo po potrebi prilagodi:

   ```bash
   cp .env.example .env
   ```

   Če so vrata `5432` na tvojem računalniku že zasedena, v `.env` nastavi drug `DB_PORT` (npr. `5433`) in ista vrata uporabi v `DATABASE_URL`. Če so zasedena vrata `3000`, nastavi `BACKEND_PORT` (npr. `3001`).

3. Zaženi sistem (prvi zagon zgradi slike in traja nekaj minut):

   ```bash
   docker compose up -d
   ```

   Ob zagonu backend uveljavi migracije (`prisma migrate deploy`) in generira Prisma odjemalca. Spremembe kode v `backend/` ga samodejno ponovno zaženejo.

4. Preveri, ali sta baza in backend pripravljena (stanje `healthy`):

   ```bash
   docker compose ps
   curl http://localhost:3000/api/zdravje   # vrata BACKEND_PORT iz .env
   ```

   Frontend je na <http://localhost:5173>. Razvojni strežnik Vite zahteve na `/api` posreduje backendu (proxy, ADR-0012), zato `curl http://localhost:5173/api/zdravje` vrne isto. Spremembe kode v `frontend/` se v brskalniku prikažejo takoj. Če so vrata `5173` zasedena, nastavi `FRONTEND_PORT`.

5. Naloži začetne podatke (testni uporabniki, pravila izposoje, kategorije in oprema). Skripta je idempotentna, zato jo lahko poženeš večkrat:

   ```bash
   docker compose exec backend npm run db:seed
   ```

6. Odpri <http://localhost:5173> in se prijavi z enim od [testnih računov](#testni-računi), npr. `student@rentaj.test` / `student123`. Študent, asistent in profesor pridejo na *Katalog*, tehnik na *Nadzorno ploščo*, administrator na *Uporabnike*.

Po `git pull` z novimi paketi ponovno zgradi slike: `docker compose up -d --build -V`. Če backend po posodobitvi ne pozna nove poti (odgovor »Pot ne obstaja.«), ga ponovno zaženi z `docker compose restart backend` – samodejni ponovni zagon ob spremembah lahko ob hkratni zamenjavi več datotek zgreši zadnjo.

Sistem ustavi z `docker compose down`. Podatki baze ostanejo v volumnu `db-podatki`; izbrišeš jih z `docker compose down -v`.

### Testni računi

> **Samo za razvoj.** Te račune ustvari seed skripta; v produkciji se ne uporabljajo.

| Vloga | E-pošta | Geslo |
|---|---|---|
| Administrator | `admin@rentaj.test` | `admin123` |
| Tehnik | `tehnik@rentaj.test` | `tehnik123` |
| Študent | `student@rentaj.test` | `student123` |
| Asistent | `asistent@rentaj.test` | `asistent123` |
| Profesor | `profesor@rentaj.test` | `profesor123` |

### Backend brez Dockerja

Backend lahko poženeš tudi brez Dockerja (baza naj teče v Compose):

```bash
cd backend
npm install
npm run db:generate
npm run db:seed
npm run dev
```

Frontend na gostitelju (proxy prebere `BACKEND_PORT` iz korenskega `.env`):

```bash
cd frontend
npm install
npm run dev
```

Po dodajanju paketa v Compose ponovno zgradi sliko: `docker compose up -d --build -V frontend` (oziroma `backend`).

## Testi in kakovost kode

Testi tečejo na ločeni bazi `rentaj_test` na istem strežniku PostgreSQL (baza naj teče v Compose). Testi jo ustvarijo sami, uveljavijo migracije in jo pred vsakim testom izpraznijo; razvojne baze se ne dotaknejo.

```bash
cd backend
npm test              # vsi testi enkrat
npm run test:watch    # ponovni zagon ob spremembah
npm run lint          # ESLint
npm run format        # Prettier popravi oblikovanje
```

Frontend ima enake ukaze (`npm test`, `npm run lint`, `npm run format`) v mapi `frontend/`; testi ne potrebujejo baze.

Poročilo o pokritosti: `npm run test:coverage` (v `backend/` oziroma `frontend/`) ga zapiše v mapo `coverage/`.

## CI/CD

Cevovod [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) se sproži ob vsakem pull requestu v `main` in ob vsakem pushu na `main`. Spremembe se razvijajo v ločenih vejah in v `main` združujejo prek pull requestov; zaščita veje `main` zahteva uspešne jobe `lint`, `build` in `test`.

| Faza | Kaj naredi |
|---|---|
| `lint` | ESLint in Prettier za backend in frontend. Ob napaki job pade. |
| `build` | Zgradi frontend (`dist/`) in produkcijsko Docker sliko backenda ([`backend/Dockerfile.prod`](backend/Dockerfile.prod)) ter oboje shrani kot artefakta. Odvisnosti npm in sloji Docker slike se predpomnijo. |
| `test` | Backend (s PostgreSQL) in frontend testi s pokritostjo; poročilo se shrani kot artefakt `coverage`. Ob padlem testu pade cevovod. |
| `deploy` | Samo ob pushu na `main`, ko so `lint`, `build` in `test` uspešni, v okolju `production`. Sliko backenda iz artefakta potisne v GHCR in jo namesti na Render (baza na Neon), `dist/` pa naloži na Netlify. Netlify zahteve `/api/*` posreduje backendu na naslovu iz spremenljivke `BACKEND_URL`. |

Namestitev uporablja te nastavitve okolja `production` (Settings → Environments):

| Ime | Vrsta | Vrednost |
|---|---|---|
| `NETLIFY_AUTH_TOKEN` | secret | Netlify personal access token |
| `NETLIFY_SITE_ID` | secret | ID strani na Netlify |
| `RENDER_DEPLOY_HOOK_URL` | secret | Deploy hook storitve na Render |
| `BACKEND_URL` | variable | Javni naslov backenda na Render, npr. `https://rentaj-me-backend.onrender.com` |
| `FRONTEND_URL` | variable | Javni naslov frontenda na Netlify |

Na Render so nastavljene spremenljivke `DATABASE_URL` (Neon), `JWT_SECRET`, `NODE_ENV=production` in `SEED_OB_ZAGONU=true`, ki ob zagonu naloži testne račune. Brezplačna storitev na Render po neaktivnosti zaspi, zato prva zahteva traja do minute.

## Dokumentacija

1. [Zasnova rešitve](docs/01-zasnova-resitve.md)
2. [Funkcionalnosti in obseg](docs/02-funkcionalnosti-in-obseg.md)
3. [Podatkovni model](docs/03-podatkovni-model.md)
4. [Arhitektura in tehnološki sklad](docs/04-arhitektura-in-tehnoloski-sklad.md)
5. [Uporabniške zgodbe](docs/05-uporabniske-zgodbe.md)
6. [Wireframes](docs/06-wireframes.md)
7. [Oblikovanje](docs/07-oblikovanje.md) in [odločitve o oblikovanju](docs/oblikovanje.md) (tokeni, komponente, dostopnost)

Arhitekturne odločitve so zapisane v [docs/adr/](docs/adr/).
