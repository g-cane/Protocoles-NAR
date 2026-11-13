# Protocoles NAR

Application web des protocoles médicaux de l’unité de neuro-anesthésie-réanimation (S.A.R. Pellegrin, version 4.1, janvier 2026).

Le livret PDF de 103 pages est découpé en **49 fiches** (31 en réanimation, 18 en anesthésie), chacune organisée en rubriques dépliables.

> Ce livret est à l’usage exclusif des praticiens et des internes de l’unité de neuro-anesthésie-réanimation du C.H.U. de Bordeaux. Il s’agit d’une synthèse des protocoles médicaux et ne se soustrait en aucun cas aux recommandations de bonne pratique clinique.

## Ce que fait l’application

- **Deux entrées** : Réanimation et Anesthésie, puis des groupes (neuro-réanimation, infectiologie, gestion des traitements…).
- **Rubriques dépliables** avec un pictogramme par rubrique (diagnostic, traitement, surveillance…).
- **Recherche plein texte** insensible aux accents, avec ouverture directe de la rubrique trouvée (touche `/` au clavier).
- **Figures agrandissables** : algorithmes et tableaux complexes repris tels quels du livret.
- **Pages du livret** : chaque fiche donne accès aux pages d’origine, pour vérifier une valeur.
- **Favoris** et fiches consultées récemment (conservés sur l’appareil).
- **Liens** vers les recommandations (SFAR, HAS, sociétés internationales) et renvois entre fiches.
- Thème clair / sombre, utilisable au téléphone, installable sur l’écran d’accueil et consultable hors-ligne après une première visite.

## Utilisation

Le site est entièrement statique : il suffit de servir le dossier `docs/`.

```bash
npm install
npm run build      # régénère docs/index.html
npm run serve      # http://localhost:4173
```

### Publication avec GitHub Pages

Dans les réglages du dépôt : *Settings → Pages → Deploy from a branch*, branche principale, dossier `/docs`.

## Modifier ou ajouter une fiche

Chaque fiche est un fichier Markdown dans `content/rea/` ou `content/anesth/`. L’ordre d’affichage suit le nom du fichier.

```markdown
---
id: rea-hsa
titre: Hémorragie sous-arachnoïdienne
court: HSA
groupe: Neuro-réanimation
icone: brain
pages: 9-11
resume: Une ligne affichée sous le titre.
mots: mots-clés supplémentaires pour la recherche
---

## Titre d’une rubrique

Texte, listes et tableaux en Markdown.

> [!WARNING]
> Encadré d’alerte. Types disponibles : NOTE, TIP, IMPORTANT, WARNING, CAUTION.

![Légende de la figure](figures/htic-algo.webp)

Renvoi vers une autre fiche : [HTIC](#rea-htic).
```

- `icone` : un nom de pictogramme de [lucide.dev/icons](https://lucide.dev/icons).
- `groupe` : l’un des groupes déclarés en tête de `build.mjs`.
- Le pictogramme d’une rubrique est choisi d’après son titre ; pour l’imposer : `## Titre {icon=syringe}`.
- La génération s’arrête avec un message explicite si un lien interne, une figure ou un pictogramme n’existe pas.

Après modification : `npm run build`, puis commit.

### Mettre à jour les figures depuis une nouvelle version du livret

```bash
python3 tools/figures.py chemin/vers/Protocoles_NAR.pdf
```

Le script (poppler + Pillow) régénère `docs/figures/` et `docs/pages/`. Les cadres de découpe sont listés en tête du script. Le PDF lui-même n’est pas versionné.

## Organisation du dépôt

| Chemin | Rôle |
|---|---|
| `content/` | Les 49 fiches en Markdown |
| `src/` | Interface : styles, script, pictogrammes des deux entrées, service worker |
| `build.mjs` | Générateur du site (Markdown → `docs/index.html`) |
| `tools/figures.py` | Extraction des figures et des pages du PDF |
| `docs/` | Site généré, prêt à publier |

## Fidélité au livret

Le texte a été retranscrit depuis le PDF, puis tous les nombres de chaque fiche ont été comparés automatiquement à ceux des pages d’origine. Les écarts volontaires sont les suivants ; ils sont signalés par une note dans la fiche quand ils touchent une valeur.

| Fiche | Livret | Application |
|---|---|---|
| ACSOS | Glycémie « 1,4 – 1,8 g/dl » | g/l |
| Doppler transcrânien | Sonde « 2 – 4 Hz » | MHz |
| Bon usage des anti-infectieux | Pic et vallée des aminosides en « mg/ml » | mg/l |
| AVC ischémique | « PAM max 185 mmHg / PAM max 110 mmHg » | PAS max 185 mmHg / PAM max 110 mmHg |
| AVC hémorragique, antithrombotiques | Plaquettes « 0,5 à 0,7x101 pour 10 kg » | 0,5 à 0,7 × 10¹¹ |
| Antithrombotiques | Idarucizumab « 2 x 2,5 mg/50 ml » | 2 × 2,5 g/50 ml |
| Dysnatrémies | Diurèse cible « 1 et 1,5 ml/kg » ; uricémie « 240 mol/L » | ml/kg/h ; µmol/l |
| Vitaminothérapie | Tableau en anglais | Traduit en français |
| Plusieurs | Coquilles (cotrimoxazole, caspofungine, fosfomycine, *C. kefyr*…) | Corrigées |

Trois fiches n’existent dans le livret que sous forme d’image (état de mal épileptique, épuration extra-rénale, prélèvement d’organes) : leur texte a été saisi à la main d’après l’image, qui reste affichée et fait foi.

### Points à faire relire par l’équipe

- **Lévosimendan** (vasospasme, p. 19) : posologie de 0,4 µg/kg/min pour une seule perfusion de 25 mg sur 24 h ; à 70 kg, 0,4 µg/kg/min représente environ 40 mg par 24 h.
- **Score CHA₂DS₂-VASc** (p. 76) : âge > 75 ans coté 1 point dans le livret.
- **Adénome hypophysaire** (p. 85) : la situation « pas d’insuffisance corticotrope » est décrite par des critères d’insuffisance.
- **Anti-arythmiques** (p. 74) : cellule « H-24 / J1 » commune à toutes les classes.

Les rubriques « Pour aller plus loin » contiennent des liens ajoutés lors de la mise en forme ; ils ne font pas partie du livret.

## Version publique

Cette version ne contient pas les données nominatives ni les coordonnées internes du livret :

- la composition des équipes (pages 5 et 6) n’est pas reprise ;
- les numéros de poste, le numéro de portable et l’adresse électronique sont retirés du texte ;
- sur les images des pages et des figures, ces mêmes éléments ainsi que les logos sont masqués par un cadre gris (zones listées dans `MASQUES`, en tête de `tools/figures.py`).

Certaines figures proviennent de publications tierces, citées dans les fiches : HAS, BMJ, groupe SFAR – SFD, classification ASA.

## Crédits

Pictogrammes : [Lucide](https://lucide.dev) (licence ISC). Police : IBM Plex (SIL Open Font License).
