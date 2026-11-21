# Tycoon Maker 🏗️

Tycoon Maker is een browsergebaseerde game-editor waarmee je je eigen tycoon-games kunt bouwen. Plaats objecten, maak koopknoppen, stel inkomsten in en ontwerp volledig aangepaste UI's. Je bepaalt zelf hoe je game werkt — de mogelijkheden zijn eindeloos!

## 🎮 Spelen

Open `index.html` via een lokale webserver om Tycoon Maker te starten.

Open bijvoorbeeld een terminal in de projectmap en voer uit:

```bash
py -m http.server 8000
```

Open daarna [http://localhost:8000](http://localhost:8000) in je browser.

Gebruik bij voorkeur een lokale webserver in plaats van `index.html` rechtstreeks te openen via `file://`.

## 🏗️ De editor

Met de editor kun je je eigen tycoon-wereld bouwen.

- **3D-wereld:** plaats en bewerk objecten in je gamewereld.
- **Objecten:** gebruik modellen en plaats ze op de gewenste locatie.
- **Tycoon Buttons:** maak koopknoppen waarmee spelers nieuwe onderdelen kunnen vrijspelen.
- **Inkomsten:** stel in hoeveel geld een knop per seconde oplevert.
- **Priorities:** bepaal in welke volgorde onderdelen beschikbaar worden.
- **Activators:** gebruik Priority Activators en ID Activators om afhankelijkheden tussen knoppen te maken.
- **Transitions:** geef objecten animaties zoals `from cave`, `from heaven` en `grow`.

## 🖥️ Custom UI Editor

Ontwerp je eigen game-interface met het ingebouwde UI-systeem.

- **Buttons:** voeg interactieve knoppen toe.
- **Text:** plaats tekst op je interface.
- **Cubes:** voeg visuele elementen toe.
- **Drag & Drop:** verplaats en wijzig de grootte van UI-elementen.
- **Styling:** pas kleuren, tekstgrootte, border radius en andere eigenschappen aan.
- **Z-index:** bepaal welke elementen boven andere elementen verschijnen.
- **Button Actions:** wijs acties toe aan knoppen.
- **Shortcuts:** open je UI met een ingestelde sneltoets.

Je gemaakte UI's worden opgeslagen en kunnen in Play Mode worden gebruikt.

## 🕹️ Play Mode

Test je gemaakte tycoon alsof je een speler bent.

- Koop onderdelen met je beschikbare geld.
- Verdien geld via aangekochte onderdelen.
- Gebruik je eigen UI's.
- Test knopacties en afhankelijkheden.
- Beweeg door je gebouwde wereld met je character.

## 💾 Opslaan

Tycoon Maker gebruikt lokale opslag om projectgegevens te bewaren.

Je kunt je project verder bewerken zonder telkens opnieuw te beginnen. UI-instellingen, objectgegevens en andere opgeslagen projectinformatie blijven beschikbaar na het verversen van de pagina.

## 📁 Projectbestanden

De projectstructuur is opgesplitst in verschillende onderdelen:

```text
TycoonMaker/
├── index.html
├── style.css
├── main.js
├── play/
│   ├── play.html
│   ├── play.css
│   └── play.js
└── models/
    └── character.glb
```
(te lui om dit aan te passen naar de echte structuur. maar er is ook nog een ui folder)


- `index.html` — hoofdinterface van de editor.
- `style.css` — styling van de editor.
- `main.js` — editorlogica, objecten en bouwsystemen.
- `play/play.html` — gamepagina voor Play Mode.
- `play/play.css` — styling van Play Mode.
- `play/play.js` — gameplay en gamefunctionaliteit.
- `models/` — 3D-modellen, waaronder het character.

## ⚙️ Technologie

Tycoon Maker wordt gebouwd met:

- HTML
- CSS
- JavaScript
- [Babylon.js](https://www.babylonjs.com/) — 3D-engine voor de gamewereld.

## 📢 Updates

- **Custom UI System:**

  - Volledig nieuw systeem voor het bouwen van eigen game-interfaces.
  - Ondersteuning voor buttons, tekst en visuele elementen.
  - Aanpasbare kleuren, afmetingen, positie en Z-index.
  - Acties en sneltoetsen.
  - Opslaan en laden van gemaakte UI's.
  - Integratie met Play Mode.

- **Tycoon Editor:**

  - Bouwsysteem voor tycoon-games.
  - Koopknoppen en inkomsten per seconde.
  - Priorities en activators.
  - Ondersteuning voor eigen 3D-modellen.

- **Play Mode:**

  - Aparte gameomgeving.
  - Character movement.
  - Interactie met gekochte onderdelen.
  - Ondersteuning voor custom UI's.

## 📄 Licentie en credits

Tycoon Maker is een persoonlijk project van [Larsie1103](https://github.com/Larsie1103).

De broncode en ontwerpen in deze repository zijn eigendom van de maker. Herpublicatie of hergebruik is niet toegestaan zonder toestemming.

### Special Thanks

- **ChatGPT (OpenAI)** — Programming assistance, debugging, feature development and technical guidance.
- **Grok (xAI)** — Code cleanup, bug discovery and *maaaaayyyybe* bug creation.

En natuurlijk iedereen die helpt met testen en feedback geven!
