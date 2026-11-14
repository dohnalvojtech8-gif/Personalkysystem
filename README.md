# Perso

Personální stravování pro restaurace: pověřený člověk zapíše celou směnu, zaměstnanec vidí vlastní bilanci a administrátor spravuje provoz a historii změn.

## Co aplikace umí

- Přihlášení uživatelským jménem a heslem, samostatné účty zaměstnanců.
- Rychlý zápis přes oblíbená jídla, hledání zaměstnance, počty porcí a obaly.
- Jeden příspěvek na zaměstnance a den; doplnění zápisu neobnovuje limit.
- Vlastní směny, příspěvky, pracovní pozice, kategorie jídel a ceny.
- Obaly hradí podnik, limit směny nebo zaměstnanec mimo limit.
- Zaměstnanci vidí vlastní historii, doplatky ke srážce z výplaty, vlastní kalendář směn a nejčastější jídla.
- Administrátor uděluje oprávnění k zápisu za ostatní i přímo na profilu zaměstnance.
- Server eviduje autora, čas a původní i nové hodnoty změn; historie je chráněná databázovým triggerem proti přepsání a smazání.
- Měsíční přehledy se záložkami pro jednotlivé dny, souhrn zaměstnanců a CSV export.
- Archivace zaměstnanců, jídel, směn a obalů zachovává minulost.
- Doplatky se automaticky sčítají do měsíční srážky z výplaty. Ruční označování úhrad je odstraněno. Historický příznak `paid` se uchovává pouze pro kompatibilitu, nesnižuje srážku a nezamyká úpravy.

## Provoz

Node.js 22+ a PostgreSQL (včetně Supabase). Na Renderu použijte web service:

- Build: `npm ci --omit=dev`
- Start: `npm start`
- Health check: `/api/health`
- Proměnné prostředí: `NODE_ENV=production`, `DATABASE_URL`, `DATABASE_SSL=true`, `SETUP_TOKEN`.
- Volitelně `APP_URL` jako přesný veřejný origin bez koncového lomítka.

Databázové přihlašovací údaje patří jen do tajných proměnných prostředí. Žádný databázový klíč, heslo ani připojovací řetězec se neposílá do prohlížeče. Pro Supabase preferujte session pooler. Připojení ověřuje TLS certifikát. Oficiální veřejný kořenový certifikát Supabase je v `certs/supabase-ca.crt`; jeho důvěra doplňuje systémové CA a ověřování se nevypíná. Pro vlastní autoritu lze nastavit `DATABASE_CA_FILE`.

`SETUP_TOKEN` musí být náhodný řetězec s alespoň 32 znaky. První administrátor se vytvoří pouze pomocí odkazu `https://VAŠE-APLIKACE/#setup=JEDNORÁZOVÝ-TOKEN`. Token se z URL odstraní před načtením aplikace a po vytvoření admina ho už nelze znovu použít. Admin má uživatelské jméno `admin` a zvolí si vlastní heslo. Další účty vytváří administrátor. Hesla musí mít minimálně 12 znaků.

První start transakčně připraví izolované schéma `perso`; existující tabulky ostatních aplikací se nemění. Data jsou uložená na PostgreSQL serveru. Konfigurace a denní záznamy se aktualizují v transakci se zámkem a kontrolou revize; souběžný zápis vyžádá obnovení místo přepsání cizích změn. Audit má samostatnou tabulku. V UI se zobrazuje posledních 2 000 událostí, starší zůstávají v databázi. Každý provoz má oddělený stav (nejvýše 1 000 zaměstnanců a 50 000 denních záznamů na provoz); při velkém objemu je vhodná stránkovaná evidence namísto načítání celého provozu.

Zajistěte zálohování databáze podle plánu Supabase. Bezplatný Render může po nečinnosti uspávat službu; data zůstávají v externí databázi.

## Bezpečnost

Server ověřuje role u každého zápisu a používá aktuální oprávnění. Běžnému zaměstnanci nevrací záznamy ostatních. Pověřený zaměstnanec má přístup k zápisům směny, ale nemůže spravovat ceník, účty, oprávnění ani mazat záznamy. Autor a audit vznikají na serveru. Klient nesmí měnit uložené ceny a příspěvky nebo podvrhnout cenu nové položky.

Hesla jsou hashovaná scryptem a náhodnou solí. Přihlášení používá náhodné session tokeny, jejich hash v databázi a HttpOnly/Secure/SameSite cookies s platností 12 hodin. Změna hesla a archivace účtu ruší dosavadní přihlášení. Zápisy ověřují původ požadavku, přihlášení má sdílené databázové omezení pokusů. Databázové tabulky jsou v neveřejném schématu s RLS; přístup přes Supabase klientský API není povolený.

## Vývoj a ověření

```sh
npm ci
npm run check
npm test
node test/browser.mjs
```

Testy používají skutečný PostgreSQL engine ve WebAssembly (PGlite), ne vzdálenou provozní databázi. Ověřují výpočty, ceny, role, odmítnutí podvržených dat, transakční audit, srážky z výplat, soukromé kalendáře směn, hesla, ochranu proti cizímu původu, souběžné verze i přetrvání dat po opětovném přihlášení. Prohlížečové ověření používá Playwright a lokální Chromium. Na běžném vývojovém zařízení lze upravit `executablePath` v `test/browser.mjs`.

## Více provozů a majitelé

Hlavní administrátor (`admin`, role `superadmin`) má stránku **Provozy**. Pouze on vytváří nové provozy, vydává nebo obnovuje přístup majitele a pozastavuje provoz. U vytvoření dostane jednorázově náhodné dočasné jméno a heslo; lze je zkopírovat nebo stáhnout. Heslo se ukládá pouze jako scrypt hash. Platnost dočasného přístupu je 72 hodin.

Majitel se přihlásí dočasnými údaji a před přístupem k datům musí zvolit **nové uživatelské jméno i nové heslo**. Server odmítá všechny obchodní operace, dokud není aktivace dokončená. Aktivace zruší dočasné přihlášení i všechny starší sessions. Uživatelská jména jsou globálně jedinečná; heslo má 12–128 znaků.

Majitel spravuje zaměstnance a jejich oprávnění, jídelníček, ceny, směny, obaly, zápisy, srážky z výplat, měsíční přehledy a audit výhradně svého provozu. Nemůže vytvářet další provozy, měnit role majitelů ani přistupovat k cizím účtům a datům. Server odvozuje provoz od přihlášeného účtu. Hlavička `X-Perso-Venue` umožňuje hlavnímu administrátorovi zvolit provoz; ostatním rolím nemůže změnit rozsah přístupu.

Tabulky `venues` a `venue_states` doplňují existující schéma. Původní evidence zůstává v původní tabulce `state` bez kopírování nebo přepisu. Existujícímu administrátorovi se doplní role `superadmin` a zaměstnancům původní provoz. Přihlášení, hesla, záznamy a audit zůstávají zachované. Nové záznamy auditu mají vždy identifikátor provozu. Pozastavení provozu ruší přihlášení majitele a zaměstnanců; data nemaže. Obnovení dočasného přístupu majitele ruší jeho dosavadní heslo i sessions a znovu vyžaduje vlastní přihlášení.

Rozšířené kontroly:

```sh
npm run check
npm test
node test/browser.mjs
node test/venues-browser.mjs
```

API testy navíc pokrývají zákaz přístupu mezi dvěma provozy, pokus o přepsání hesla cizího zaměstnance, povinnou aktivaci, expiraci, konflikt jména, obnovu majitele, pozastavení, ochranu auditu a skutečný upgrade ze starého schématu. Prohlížečové testy vytvářejí dvě restaurace, oba majitele aktivují, ověřují jejich správu a oddělení dat, stahování údajů, obnovení přístupu a mobilní zobrazení. Testy běží výhradně na lokálních databázích, ne nad zákaznickými daty.

## Kalendář a statistiky

Kalendář v bočním panelu i v osobním přehledu vždy patří jednomu profilu. Zaměstnanec (i bez oprávnění zapisovat jídla) může vytvářet, upravovat a odstraňovat vlastní směny; pověřený zapisovatel nemá přístup ke kalendářům ostatních. Majitel může zvolit profil svého zaměstnance. Víkendy jsou zvýrazněné, kalendář zobrazuje i zápisy stravy příslušného profilu. Čas konce před začátkem znamená noční směnu do dalšího dne; překryvy včetně sousedních dnů se odmítnou.

Směny se uchovávají v `plannedShifts` v existujícím JSONB stavu provozu; starší data fungují bez migrace. `/api/schedule` ověřuje profil, provoz, oprávnění, revizi a zapisuje audit transakčně. Běžné `/api/state` plánované směny nevrací a při změnách stravy je zachovává. Plán směny sám nevytváří příspěvek ani jídlo.

Statistiky jsou pouze pro majitele a hlavního administrátora, filtrovány měsícem: počty porcí, ceny jídel i obalů, podíl doplatků podle položek a srážky podle zaměstnanců. Doplatek nad limit se pro analytiku poměrně rozděluje podle cen položek čerpajících limit, na přesné haléře; obaly hrazené zaměstnancem se započítávají celé. Historické ceny zůstávají zachované.

Perso připravuje měsíční částky ke srážce a export CSV; samotné odeslání srážek do mzdového systému zatím nemá integraci.

Kontrola syntaxe: `npm run check`. Doménové a HTTP testy: `npm test`. Kalendář, soukromí profilů, noční směny, mobilní rozložení a statistiky v prohlížeči: `node test/calendar-browser.mjs`.
