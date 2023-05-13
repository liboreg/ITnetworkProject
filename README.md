# ITnetworkProject
## Podpora prodeje online kurzů

Aplikace slouží k podpoře registrace na online kurzy, které probíhají online na platformě Zoom, později přibude možnost prodeje nahrávek.

Registrační formulář je zde:
( vytvářel jsem jej ve FrameWorku Wix )

https://www.ivetahavlova.cz/prihlaska-na-kurz
![prihlaska_na_kurz-jen_ukazkove.png](img/prihlaska_na_kurz-jen_ukazkove.png)

Po zvolení druhé volby se formulář rozšíří o kompletní informace:
![prihlaska_na_kurz-full.png](img/prihlaska_na_kurz-full.png)

### Struktura tabulky pro registrační formulář:
![subCourses.png](img/subCourses.png)

### Přihláška na kurz - přehled
![prihlaska_na_kurz-prehled.png](img/prihlaska_na_kurz-prehled.png)

## Kód pro vytváření objednávek a faktur - [js/Invoice.js](js/Invoice.js)

Třída Invoice obsahuje tyto metody:
- **creEstimate** - vytvoření objednávky 
- **creVat** - vytvoření faktury

Obě používají metodu create ( jen s jinými parametry )
- a **createLoop** - pro ctění přístupu DRY, Dont Repeat Yourself

### Soubor [js/invoice.jsw](js/invoice.jsw) obsahuje vytvoření nové instance třídy Invoice a funkce pro volání z frontendu

## Kód pro zpracování bankovních transakcí - [js/BankTransactions.js](js/BankTransactions.js)

Třída BankTransactions obsahuje tyto metody
- **fetchData** - načtění bankovních transakcí přes API ( klíč je uchován skryt v Secret Managerovi ve Wixu )
- **saveData** - uložení dat do tabulky eshop_bankTransactions
- a **matchPayments** - spárování dat na základě variabilního symbolu a vytvoření objednávky

## Modul s SQL příkazy - [js/datasql.jsw](js/datasql.jsw)

### Struktura tabulky pro bankovní transakce:
![eshop_bankTransactions.png](img/eshop_bankTransactions.png)

### Struktura tabulky pro logování chyb:
![errorLog.png](img/errorLog.png)

