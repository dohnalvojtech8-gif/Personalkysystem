# Perso

Personální stravování pro restaurace: pověřený člověk zapíše celou směnu, zaměstnanec vidí vlastní bilanci a administrátor spravuje provoz a historii změn.

## Co aplikace umí

- Přihlášení uživatelským jménem a heslem, samostatné účty zaměstnanců.
- Rychlý zápis přes oblíbená jídla, hledání zaměstnance, počty porcí a obaly.
- Jeden příspěvek na zaměstnance a den; doplnění zápisu neobnovuje limit.
- Vlastní směny, příspěvky, pracovní pozice, kategorie jídel a ceny.
- Obaly hradí podnik, limit směny nebo zaměstnanec mimo limit.
- Zaměstnanci vidí vlastní historii, doplatky, uhrazené částky a nejčastější jídla.
- Administrátor uděluje oprávnění k zápisu za ostatní i přímo na profilu zaměstnance.
- Server eviduje autora, čas a původní i nové hodnoty změn; historie je chráněná databázovým triggerem proti přepsání a smazání.
- Měsíční přehledy se záložkami pro jednotlivé dny, souhrn zaměstnanců a CSV export.
- Archivace zaměstnanců, jídel, směn a obalů zachovává minulost.
- Uhrazené zápisy jsou uzamčené, dokud admin nezruší označení úhrady.

## Provoz

Node.js 22+ a PostgreSQL (včetně Supabase). Na Renderu použijte web service:

- Build: `npm ci --omit=dev`
- Start: `npm start`
- Health check: `/api/health`
- Proměnné prostředí: `NODE_ENV=production`, `DATABASE_URL`, `DATABASE_SSL=true`, `SETUP_TOKEN`.
- Volitelně `APP_URL` jako přesný veřejný origin bez koncového lomítka.

Databázové přihlašovací údaje patří jen do tajných proměnných prostředí. Žádný databázový klíč, heslo ani připojovací řetězec se neposílá do prohlížeče. Pro Supabase preferujte session pooler. Připojení ověřuje TLS certifikát.

`SETUP_TOKEN` musí být náhodný řetězec s alespoň 32 znaky. První administrátor se vytvoří pouze pomocí odkazu `https://VAŠE-APLIKACE/#setup=JEDNORÁZOVÝ-TOKEN`. Token se z URL odstraní před načtením aplikace a po vytvoření admina ho už nelze znovu použít. Admin má uživatelské jméno `admin` a zvolí si vlastní heslo. Další účty vytváří administrátor. Hesla musí mít minimálně 12 znaků.

První start transakčně připraví izolované schéma `perso`; existující tabulky ostatních aplikací se nemění. Data jsou uložená na PostgreSQL serveru. Konfigurace a denní záznamy se aktualizují v transakci se zámkem a kontrolou revize; souběžný zápis vyžádá obnovení místo přepsání cizích změn. Audit má samostatnou tabulku. V UI se zobrazuje posledních 2 000 událostí, starší zůstávají v databázi. Provoz je určený pro jednu restauraci (nejvýše 1 000 zaměstnanců a 50 000 denních záznamů); při velkém objemu je vhodná stránkovaná evidence namísto načítání celého provozu.

Zajistěte zálohování databáze podle plánu Supabase. Bezplatný Render může po nečinnosti uspávat službu; data zůstávají v externí databázi.

## Bezpečnost

Server ověřuje role u každého zápisu a používá aktuální oprávnění. Běžnému zaměstnanci nevrací záznamy ostatních. Pověřený zaměstnanec má přístup k zápisům směny, ale nemůže spravovat ceník, účty, oprávnění, úhrady ani mazat záznamy. Autor a audit vznikají na serveru. Klient nesmí měnit uložené ceny a příspěvky nebo podvrhnout cenu nové položky.

Hesla jsou hashovaná scryptem a náhodnou solí. Přihlášení používá náhodné session tokeny, jejich hash v databázi a HttpOnly/Secure/SameSite cookies s platností 12 hodin. Změna hesla a archivace účtu ruší dosavadní přihlášení. Zápisy ověřují původ požadavku, přihlášení má sdílené databázové omezení pokusů. Databázové tabulky jsou v neveřejném schématu s RLS; přístup přes Supabase klientský API není povolený.

## Vývoj a ověření

```sh
npm ci
npm run check
npm test
node test/browser.mjs
```

Testy používají skutečný PostgreSQL engine ve WebAssembly (PGlite), ne vzdálenou provozní databázi. Ověřují výpočty, ceny, role, odmítnutí podvržených dat, transakční audit, zamknuté úhrady, hesla, ochranu proti cizímu původu, souběžné verze i přetrvání dat po opětovném přihlášení. Prohlížečové ověření používá Playwright a lokální Chromium. Na běžném vývojovém zařízení lze upravit `executablePath` v `test/browser.mjs`.
