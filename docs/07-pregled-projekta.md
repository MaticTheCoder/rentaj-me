# Pregled prevzetega projekta

Pregled projekta **Rentaj.me** ob menjavi projektov. Projekt sem pregledal prek dokumentacije (`docs/01`–`06`, ADR-ji), kode backenda in frontenda ter lokalno zagnane aplikacije (Docker Compose, `npm run db:seed`, prijava z vsemi testnimi vlogami). Zagnal sem tudi obstoječe teste: backend 221/221, frontend 277/277.

## Implementirane funkcionalnosti za MVP

Dokument [02](02-funkcionalnosti-in-obseg.md) kot MVP opredeli funkcionalnosti F1–F7, dokument [05](05-uporabniske-zgodbe.md) pa jim doda podporne zgodbe za prijavo ter upravljanje uporabnikov in opreme.

| Funkcionalnost | Zgodbe | Stanje |
|---|---|---|
| Prijava in odjava (JWT v piškotku `httpOnly`, preusmeritev po vlogi) | US-01 | Implementirano |
| F1 – Katalog opreme in koledar zasedenosti | US-02 | Implementirano |
| F2 – Oddaja rezervacije s preverjanjem prekrivanja in pravil vloge | US-03, US-04 | Implementirano |
| F3 – Odobritev in zavrnitev z obveznim razlogom | US-05, US-06 | Implementirano |
| F4 – Izdaja in vračilo s stanjem opreme ter zapisom poškodbe | US-07, US-08 | Implementirano |
| F5 – Samodejno označevanje zamujenih izposoj | US-09 | Implementirano |
| F6 – Pregled lastnih izposoj | US-10 | Implementirano |
| F7 – Opozorila tehniku o zamudah in poškodbah | US-11 | Implementirano |
| Upravljanje uporabnikov (administrator) | US-18 | Implementirano |
| Upravljanje opreme in kategorij (tehnik, administrator) | US-19 | Implementirano |

Funkcionalnosti zunaj MVP (F8–F13, zgodbe US-12–US-17) niso implementirane, kar je v skladu z obsegom in je v kodi tudi označeno: v obrazcu ni stikala za dolgoročno izposojo, gumba *Prekliči* ni, iskanje in filtri v katalogu, razreševanje poškodb, zgodovina kosa in urejanje pravil pa manjkajo. Backend sicer že pozna polje `dolgorocna` in pravilo `maxDniDolgorocno`, zato je US-12 delno pripravljena.

Javne registracije ni namenoma ([ADR-0009](adr/0009-brez-javne-registracije.md)), račune ustvarja administrator.

## Ujemanje z uporabniškimi zgodbami

Podrobno sem pregledal pet zgodb, ki pokrivajo jedro MVP. Za vsak kriterij sprejemljivosti sem preveril kodo, obstoječe teste in delovanje v aplikaciji.

### US-02: Koledar zasedenosti kosa – zadošča

- Termin zasedajo le statusi `ODDANA`, `ODOBRENA` in `IZDANA` (`services/termini.js`); zavrnjene, preklicane in vrnjene rezervacije v koledarju niso označene (kriterija 1 in 2).
- `GET /api/oprema/:id/zasedenost` vrne le `od` in `do`, brez uporabnika in namena (kriterij 3).
- Kos `V_OKVARI` je označen in ga ni mogoče rezervirati, `UMAKNJEN` se v katalogu ne prikaže (kriterij 4).
- Koledar omogoča premik med meseci in ob vsakem premiku naloži zasedenost za nov mesec (kriterij 5).

### US-03: Oddaja rezervacije s preverjanjem prekrivanja – zadošča

- Validacija (Zod) zahteva vsaj en kos, termin in namen; konec pred začetkom ali začetek v preteklosti vrne `400` z napako pri polju (kriterij 1).
- Prekrivanje vrne `409` s sporočilom, npr. »… je zaseden od … do …«, oddaja pa teče v transakciji, zato ne nastane noben zapis (kriterij 2).
- Kos, ki ni `NA_VOLJO`, prepreči oddajo in je naveden v sporočilu (kriterij 3).
- Po uspešni oddaji nastane rezervacija `ODDANA` s postavkami, prikaže se potrdilo »Rezervacija oddana – čaka na odobritev tehnika« (kriterij 4).
- Hkratna oddaja je zaščitena z zaklepanjem kosov v enakem vrstnem redu; test `hkratnaOddaja.test.js` potrdi, da se shrani le ena rezervacija (kriterij 5).

### US-05: Odobritev oddane rezervacije – zadošča

- Seznam oddanih rezervacij je razvrščen po času oddaje od najstarejše in prikaže uporabnika, vlogo, kose, termin in namen (kriterij 1).
- Odobritev nastavi `ODOBRENA` in `obdelalId` (kriterij 2); iz drugega statusa vrne `409` (kriterij 3).
- Pot je omejena na vlogo `TEHNIK`, administrator in profesor dobita `403` (kriterij 4).
- Uporabnik na *Moje izposoje* vidi status »Odobrena« (kriterij 5).

### US-08: Vračilo opreme s stanjem in poškodbo – zadošča

- Vračilo je mogoče le iz statusa `IZDANA`, tudi pri zamujenih (kriterij 1).
- Pri stanju »Poškodovano« je opis obvezen, sicer `400` (kriterij 2).
- V eni transakciji se zapišejo `VRNJENA`, `vrnjenoOb`, `stanjeObVracilu` in `ZapisPoskodbe` z `razresen = false` (kriterij 3).
- `trenutnoStanje` kosa se nastavi na stanje ob vračilu (kriterij 4); vrnjena rezervacija ni več zamujena (kriterij 5).

### US-09: Seznam zamujenih izposoj – zadošča

- Zamuda se ne shranjuje, ampak izračuna ob branju (`IZDANA` in `konec < zdaj`, [ADR-0007](adr/0007-izracunan-status-zamujena.md)), zato je seznam točen brez procesa v ozadju (kriterija 1 in 3).
- Seznam prikaže uporabnika z e-pošto, kose, rok in dni zamude, razvrščen od največje zamude (kriterij 2); vrnjene rezervacije se ne prikažejo (kriterij 4).
- Nadzorna plošča tehnika prikazuje števec zamud, ki vodi na seznam (kriterij 5).

### Ugotovitve

Implementirane funkcionalnosti zadoščajo vsem petim pregledanim zgodbam. Projekt je skrbno dokumentiran (ADR-ji, komentarji s sklici na zgodbe) in dobro pokrit s testi. Opažanja za nadaljnje delo:

- Pri enem od zagonov frontend testov je en test občasno padel (pri ponovnih zagonih vsi uspešni), kar kaže na test, odvisen od časa izvajanja.
- Projekt je bil pripravljen le za lokalni razvoj (razvojne Docker slike, Vite proxy), zato je za namestitev potrebna produkcijska konfiguracija – urejeno v okviru CI/CD.
- Zgodbe zunaj MVP (US-12–US-17) so naslednji logični korak; najmanj dela zahteva US-12, ker jo backend že delno podpira.
