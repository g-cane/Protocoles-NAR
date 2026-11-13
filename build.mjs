#!/usr/bin/env node
// Génère le site statique (docs/) à partir des fiches Markdown de content/.
//   node build.mjs            -> docs/index.html (+ sw.js, manifest)
//   node build.mjs --artifact -> en plus, dist/protocoles-nar.html (fragment sans <html>/<head>)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { marked } from 'marked';

const ROOT = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

const META = {
  titre: 'Protocoles NAR',
  sousTitre: 'Neuro-anesthésie-réanimation',
  service: 'S.A.R. Pellegrin',
  version: 'Version 4.1 · Janvier 2026',
  pagesLivret: 103,
  preambule:
    'Ce livret est à l’usage exclusif des praticiens et des internes de l’unité de neuro-anesthésie-réanimation du C.H.U. de Bordeaux. Il s’agit d’une synthèse des protocoles médicaux et ne se soustrait en aucun cas aux recommandations de bonne pratique clinique.',
};

// Les deux grandes entrées, et l'ordre des groupes dans chacune.
const SECTIONS = [
  {
    id: 'rea',
    dossier: 'rea',
    titre: 'Réanimation',
    court: 'Réa',
    accroche: 'Neuro-réanimation, infectiologie, métabolisme, hémodynamique',
    groupes: ['Neuro-réanimation', 'Infectiologie', 'Métabolisme et nutrition', 'Hémodynamique, sang et rein', 'Organisation'],
  },
  {
    id: 'anesth',
    dossier: 'anesth',
    titre: 'Anesthésie',
    court: 'Anesth',
    accroche: 'Consultation, gestion des traitements, chirurgies spécifiques, pédiatrie',
    groupes: ['Organisation', 'Évaluation pré-opératoire', 'Gestion des traitements', 'Chirurgies spécifiques', 'Épargne sanguine', 'Pédiatrie', 'Fiches pratiques'],
  },
];

const ACCES_RAPIDE = [
  'rea-htic', 'rea-vasospasme', 'rea-eme', 'rea-avc-hemorragique', 'rea-dve', 'rea-dysnatremies',
  'anesth-antithrombotiques', 'anesth-diabete',
];

// Icône d'une rubrique, déduite de son titre (premier motif qui correspond).
const ICONES_RUBRIQUES = [
  [/pour aller plus loin|référence|source|voir aussi/i, 'book-marked'],
  [/algorithme|démarche|lecture de/i, 'workflow'],
  [/score|classification/i, 'list-ordered'],
  [/définition|introduction|principe|contexte|généralités|quand y penser|objectifs et indications|pharmacologie/i, 'info'],
  [/facteurs? de risque|étiologie|épidémiologie|mécanisme/i, 'search'],
  [/indication/i, 'circle-check'],
  [/diagnostic|clinique|quand (rechercher|prélever)|interprétation/i, 'stethoscope'],
  [/surveillance|monitorage/i, 'activity'],
  [/complication|limites|dysfonctionnement|risque|ischémie|plaie|hypoglycémie|glycémie ≥/i, 'triangle-alert'],
  [/durée|chronologie|délais|horaires|jeûne/i, 'clock'],
  [/prélèvement|bilan|examens|biologie|paraclinique/i, 'test-tubes'],
  [/posologie|doses|protocole|milrinone|lévosimendan|insulin|aminoside|anti-sarm|lactamine|antifongique|préparation|instauration|osmothérapie|tolvaptan|relais/i, 'syringe'],
  [/antibio|anti-infectieux|traitement|prise en charge|prémédication|hydrocortisone|corticotrope|cushing|formes orales|solutés|adaptation|optimisation/i, 'pill'],
  [/mesures associées|prévention|pré-opératoire|per-opératoire|post-opératoire/i, 'shield-check'],
  [/objectif|repères|points essentiels|en pratique|à maintenir/i, 'target'],
  [/température/i, 'thermometer'],
  [/réglage/i, 'sliders-horizontal'],
  [/équipe|parents|proches|effectifs|rôles|population/i, 'users'],
  [/organisation|structure|activités|consignes|déroulé|séquence|étapes|réalisation|procédure|visite|consultation|prescription|montage/i, 'clipboard-list'],
  [/locaux/i, 'map-pin'],
  [/téléphone|numéros/i, 'phone'],
  [/nutrition/i, 'utensils'],
  [/chirurg|thrombectomie|craniectomie|thrombolyse/i, 'scissors'],
  [/transfusion|anémie|urgence|aod|avk|héparine|antiagrégant/i, 'droplets'],
];
const ICONE_DEFAUT = 'file-text';

const ICONES_UI = [
  'search', 'x', 'star', 'arrow-left', 'chevron-right', 'chevron-down', 'external-link', 'moon', 'sun', 'house',
  'zoom-in', 'zoom-out', 'file-text', 'chevrons-up-down', 'chevrons-down-up', 'info', 'triangle-alert', 'octagon-alert',
  'lightbulb', 'circle-alert', 'copy', 'check', 'history', 'zap', 'book-open', 'image', 'arrow-up-right', 'link',
];

// ---------- Lecture des fiches ----------
function parseFiche(fichier, section) {
  const brut = read('content', section.dossier, fichier);
  const m = brut.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${fichier} : en-tête --- manquant`);
  const fm = {};
  for (const ligne of m[1].split('\n')) {
    const i = ligne.indexOf(':');
    if (i > 0) fm[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
  }
  for (const cle of ['id', 'titre', 'groupe', 'icone', 'pages']) if (!fm[cle]) throw new Error(`${fichier} : champ « ${cle} » manquant`);
  if (!section.groupes.includes(fm.groupe)) throw new Error(`${fichier} : groupe inconnu « ${fm.groupe} »`);
  const pages = [];
  for (const bloc of fm.pages.split(',')) {
    const [a, b] = bloc.trim().split('-').map(Number);
    for (let p = a; p <= (b || a); p++) pages.push(p);
  }
  const rubriques = [];
  let courante = null;
  for (const ligne of m[2].split('\n')) {
    const h = ligne.match(/^## (.+)$/);
    if (h) {
      courante = { titre: h[1].trim(), md: [] };
      rubriques.push(courante);
    } else if (courante) courante.md.push(ligne);
    else if (ligne.trim()) throw new Error(`${fichier} : texte avant la première rubrique « ## »`);
  }
  return { ...fm, section: section.id, pages, fichier: `${section.dossier}/${fichier}`, rubriques };
}

// ---------- Dimensions des images WebP (pour réserver la place avant chargement) ----------
function tailleWebp(chemin) {
  const b = readFileSync(chemin);
  const type = b.toString('ascii', 12, 16);
  if (type === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (type === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (type === 'VP8L') {
    const n = b.readUInt32LE(21);
    return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1];
  }
  throw new Error(`format WebP inconnu : ${chemin}`);
}

// ---------- Markdown -> HTML ----------
const TYPES_ENCADRES = {
  NOTE: ['note', 'info', 'Note'],
  TIP: ['tip', 'lightbulb', 'Astuce'],
  IMPORTANT: ['important', 'circle-alert', 'Important'],
  WARNING: ['warning', 'triangle-alert', 'Attention'],
  CAUTION: ['caution', 'octagon-alert', 'Danger'],
};
const ic = (nom, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${nom}"/></svg>`;
const iconesUtilisees = new Set(ICONES_UI);
const figuresUtilisees = new Set();
const liensInternes = [];

function rendre(md, fiche) {
  let html = marked.parse(md, { gfm: true });
  // Encadrés façon GitHub : > [!WARNING]
  html = html.replace(/<blockquote>\s*<p>\[!(\w+)\]\s*(?:<br>)?\s*/g, (tout, type) => {
    const t = TYPES_ENCADRES[type];
    if (!t) throw new Error(`${fiche.fichier} : encadré inconnu [!${type}]`);
    iconesUtilisees.add(t[1]);
    return `<blockquote class="callout callout-${t[0]}">${ic(t[1])}<div><p><span class="callout-label">${t[2]}</span> `;
  });
  html = html.replace(/(<blockquote class="callout[\s\S]*?)<\/blockquote>/g, '$1</div></blockquote>');
  // Figures
  html = html.replace(/<p><img src="figures\/([\w-]+)\.webp" alt="([^"]*)"\s*\/?><\/p>/g, (tout, nom, legende) => {
    const chemin = join(ROOT, 'docs', 'figures', `${nom}.webp`);
    if (!existsSync(chemin)) throw new Error(`${fiche.fichier} : figure absente ${nom}.webp`);
    figuresUtilisees.add(nom);
    const [w, h] = tailleWebp(chemin);
    return `<figure class="fig"><button type="button" class="fig-btn" data-zoom="figures/${nom}.webp" data-legende="${legende}"><img src="figures/${nom}.webp" alt="${legende}" width="${w}" height="${h}" loading="lazy" decoding="async"><span class="fig-zoom">${ic('zoom-in')} Agrandir</span></button><figcaption>${legende}</figcaption></figure>`;
  });
  if (/<img /.test(html.replace(/<figure[\s\S]*?<\/figure>/g, ''))) throw new Error(`${fiche.fichier} : image hors format « ![légende](figures/nom.webp) » seule sur sa ligne`);
  // Tableaux défilants
  html = html.replace(/<table(\s[^>]*)?>/g, (t) => `<div class="table-wrap">${t}`).replace(/<\/table>/g, '</table></div>');
  // Liens
  html = html.replace(/<a href="([^"]+)">/g, (tout, href) => {
    if (href.startsWith('#')) {
      liensInternes.push([fiche.fichier, href.slice(1)]);
      return `<a class="xref" href="${href}">`;
    }
    return `<a class="ext" href="${href}" target="_blank" rel="noopener noreferrer">`;
  });
  html = html.replace(/(<a class="ext"[^>]*>)([\s\S]*?)<\/a>/g, `$1$2${ic('arrow-up-right', 'ext-ic')}</a>`);
  // Numéros et adresses à copier
  html = html.replace(/<span class="copy">([^<]+)<\/span>/g, (tout, v) => `<button type="button" class="copy" data-copy="${v}" title="Copier">${v}${ic('copy')}</button>`);
  return html;
}

const enTexte = (html) =>
  html
    .replace(/<figcaption>[\s\S]*?<\/figcaption>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#39;/g, '’').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

function iconeRubrique(titre) {
  for (const [motif, nom] of ICONES_RUBRIQUES) if (motif.test(titre)) return nom;
  return ICONE_DEFAUT;
}

// ---------- Assemblage ----------
const fiches = [];
for (const section of SECTIONS) {
  const fichiers = readdirSync(join(ROOT, 'content', section.dossier)).filter((f) => f.endsWith('.md')).sort();
  for (const f of fichiers) fiches.push(parseFiche(f, section));
}
const ids = new Set();
for (const f of fiches) {
  if (ids.has(f.id)) throw new Error(`identifiant en double : ${f.id}`);
  if (!/^[a-z0-9-]+$/.test(f.id)) throw new Error(`identifiant invalide : ${f.id}`);
  ids.add(f.id);
}

const NOTE_LIENS = '<p class="added-note">Liens ajoutés lors de la mise en forme de l’application : ils ne font pas partie du livret.</p>';
const protocoles = fiches.map((f) => {
  iconesUtilisees.add(f.icone);
  return {
    id: f.id,
    s: f.section,
    t: f.titre,
    c: f.court || f.titre,
    g: f.groupe,
    i: f.icone,
    p: f.pages,
    r: f.resume || '',
    m: f.mots || '',
    k: f.rubriques.map((r) => {
      let titre = r.titre;
      let icone = null;
      const forcee = titre.match(/\s*\{icon=([\w-]+)\}\s*$/);
      if (forcee) {
        icone = forcee[1];
        titre = titre.replace(forcee[0], '');
      }
      icone = icone || iconeRubrique(titre);
      iconesUtilisees.add(icone);
      let html = rendre(r.md.join('\n'), f);
      if (/^pour aller plus loin$/i.test(titre)) html = NOTE_LIENS + html;
      return { t: titre, i: icone, h: html, x: enTexte(html) };
    }),
  };
});

for (const [fichier, cible] of liensInternes) if (!ids.has(cible)) throw new Error(`${fichier} : lien interne vers une fiche inconnue #${cible}`);
for (const id of ACCES_RAPIDE) if (!ids.has(id)) throw new Error(`accès rapide : fiche inconnue ${id}`);

// Pictogrammes : seuls ceux réellement utilisés sont embarqués.
const symboles = [...iconesUtilisees].sort().map((nom) => {
  const chemin = join(ROOT, 'node_modules', 'lucide-static', 'icons', `${nom}.svg`);
  if (!existsSync(chemin)) throw new Error(`pictogramme inconnu : ${nom} (voir lucide.dev/icons)`);
  const interieur = readFileSync(chemin, 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/<svg[^>]*>/, '').replace('</svg>', '').replace(/\s+/g, ' ').trim();
  return `<symbol id="i-${nom}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${interieur}</symbol>`;
});
const perso = read('src', 'icones.svg').replace(/<!--[\s\S]*?-->/g, '').replace(/<\/?svg[^>]*>/g, '').trim();
const sprite = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">${symboles.join('')}${perso}</svg>`;

const donnees = {
  meta: { ...META, genere: new Date().toISOString().slice(0, 10) },
  sections: SECTIONS.map(({ id, titre, court, accroche, groupes }) => ({ id, titre, court, accroche, groupes })),
  acces: ACCES_RAPIDE,
  protocoles,
};
const json = JSON.stringify(donnees).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, ' ');

const css = read('src', 'app.css');
const js = read('src', 'app.js');
const corps = read('src', 'corps.html');
const POLICES = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Sans+Condensed:wght@500;600;700&display=swap">';
const interieur = `${sprite}\n${corps}\n<script id="nar-data" type="application/json">${json}</script>\n<script>\n${js}\n</script>`;

mkdirSync(join(ROOT, 'docs'), { recursive: true });
const page = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${META.titre}</title>
<meta name="description" content="Protocoles médicaux de l’unité de neuro-anesthésie-réanimation — ${META.version}">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0e141b" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f3f5f8" media="(prefers-color-scheme: light)">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icone.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icone-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${POLICES}
<style>
:root{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}
body{margin:0}
img{max-width:100%}
[hidden]{display:none!important}
${css}
</style>
</head>
<body>
${interieur}
</body>
</html>
`;
writeFileSync(join(ROOT, 'docs', 'index.html'), page);

// Hors-ligne (GitHub Pages) : service worker versionné par le contenu.
const empreinte = createHash('sha1').update(page).digest('hex').slice(0, 10);
writeFileSync(join(ROOT, 'docs', 'sw.js'), read('src', 'sw.js').replace('__VERSION__', empreinte));
writeFileSync(
  join(ROOT, 'docs', 'manifest.webmanifest'),
  JSON.stringify(
    {
      name: 'Protocoles NAR',
      short_name: 'Protocoles NAR',
      description: 'Protocoles médicaux de neuro-anesthésie-réanimation',
      lang: 'fr',
      start_url: './',
      scope: './',
      display: 'standalone',
      background_color: '#0e141b',
      theme_color: '#0e141b',
      icons: [
        { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        { src: 'icone.svg', sizes: 'any', type: 'image/svg+xml' },
      ],
    },
    null,
    2,
  ),
);
writeFileSync(join(ROOT, 'docs', '.nojekyll'), '');

if (process.argv.includes('--artifact')) {
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  const fragment = `<title>${META.titre}</title>
<meta name="claude:viewport-fit-sides" content="cover">
${POLICES}
<style>
${css}
</style>
${interieur}
`;
  writeFileSync(join(ROOT, 'dist', 'protocoles-nar.html'), fragment);
}

const nbRubriques = protocoles.reduce((n, p) => n + p.k.length, 0);
console.log(`${protocoles.length} fiches, ${nbRubriques} rubriques, ${figuresUtilisees.size} figures, ${symboles.length} pictogrammes`);
console.log(`docs/index.html : ${(page.length / 1024).toFixed(0)} Ko — version ${empreinte}`);
const inutilisees = readdirSync(join(ROOT, 'docs', 'figures')).filter((f) => f.endsWith('.webp') && !figuresUtilisees.has(f.replace('.webp', '')));
if (inutilisees.length) console.log(`figures non utilisées : ${inutilisees.join(', ')}`);
