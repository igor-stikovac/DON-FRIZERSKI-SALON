DON Hair Studio - podeljeni CSS fajlovi

Šta je unutra:
- css/style.css -> samo @import linije
- css/base.css -> globalne promenljive, reset, dugmad, zajedničke klase
- css/header.css -> header, logo, navigacija, mobilni meni linkovi
- css/home.css -> početna, hero, usluge, footer/kontakt
- css/booking.css -> zakazivanje, kalendar, auth/login/register blokovi
- css/profile.css -> profil korisnika i kartice termina
- css/admin.css -> admin panel, kalendar, usluge, termini
- css/responsive.css -> sve @media dopune za mobilni/tablet/desktop
- backup/style-original.css -> originalni fajl koji si poslao

Kako da ubaciš:
1. Napravi backup trenutnog css/style.css u svom projektu.
2. Kopiraj sve fajlove iz ovog foldera css/ u svoj projektni folder css/.
3. U HTML fajlovima ništa ne moraš da menjaš ako već imaš:
   <link rel="stylesheet" href="css/style.css">
4. Uradi Ctrl + F5 i proveri index.html, profile.html i admin.html.

Napomena:
- Putanje do slika su ostale iste, jer su novi CSS fajlovi i dalje u css/ folderu.
- Original je sačuvan u backup/style-original.css.
