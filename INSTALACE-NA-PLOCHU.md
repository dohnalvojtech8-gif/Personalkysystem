# Persosystem: instalace na plochu

Použijte skutečnou HTTPS adresu aplikace, nikoli náhled souboru na GitHubu.

## Android (Chrome)
1. Otevřete aplikaci v Chrome a klepněte na „Instalovat aplikaci“.
2. V otevřeném návodu klepněte na „Instalovat“, pokud je tlačítko dostupné.
3. Jinak otevřete nabídku ⋮ v Chrome → „Přidat na plochu“ / „Instalovat aplikaci“ → potvrdit.
4. Aplikaci spouštějte novou ikonou na ploše nebo v seznamu aplikací.

## iPhone a iPad (Safari)
1. Otevřete aplikaci v Safari.
2. Sdílet → „Přidat na plochu“.
3. Je-li dostupné, zapněte „Otevřít jako webovou aplikaci“ a potvrďte „Přidat“.

## Počítač (Chrome nebo Edge)
Použijte ikonu instalace v adresním řádku nebo instalaci v nabídce prohlížeče.

Názvy voleb se liší podle verze systému. V prohlížeči uvnitř jiné aplikace nejprve zvolte otevření v Chrome nebo Safari. Po instalaci se aplikace otevírá ve vlastním okně s vlastní ikonou. Přihlášení a práce s daty vyžadují internet; při výpadku se zobrazí zpráva s odkazem pro opakování. Service worker neukládá účtová data ani odpovědi API do mezipaměti. Instalace nepřiděluje přístup k účtu ani nemění oprávnění.

## Ověření po nasazení
Na HTTPS zkontrolujte manifest, PNG ikony, registraci `/sw.js`, instalaci v Chrome na Androidu a přidání na plochu v Safari. Návod je dostupný i před přihlášením. Při spuštění z nainstalované ikony se tlačítko instalace nezobrazuje.
