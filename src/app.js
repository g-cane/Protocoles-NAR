(() => {
  'use strict';
  const D = JSON.parse(document.getElementById('nar-data').textContent);
  const $ = (id) => document.getElementById(id);
  const vue = $('vue');
  const champ = $('q');
  const parId = new Map(D.protocoles.map((p) => [p.id, p]));
  const sectionDe = new Map(D.sections.map((s) => [s.id, s]));

  // ---------- Petits outils ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = (nom, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${nom}"/></svg>`;
  const norm = (s) => s.normalize('NFC').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\u2019`]/g, "'").replace(/\u0153/g, 'oe');
  // Variante qui conserve la longueur du texte (pour surligner aux bonnes positions).
  const normLongueur = (s) => s.normalize('NFC').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\u2019`]/g, "'");
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

  const memoire = {
    lire(cle, defaut) {
      try {
        const v = localStorage.getItem(cle);
        return v === null ? defaut : JSON.parse(v);
      } catch (e) {
        return defaut;
      }
    },
    ecrire(cle, valeur) {
      try {
        localStorage.setItem(cle, JSON.stringify(valeur));
      } catch (e) { /* stockage indisponible : l'appli fonctionne sans */ }
    },
  };
  let favoris = memoire.lire('nar-favoris', []).filter((id) => parId.has(id));
  let recents = memoire.lire('nar-recents', []).filter((id) => parId.has(id));

  let toastTimer = 0;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
  }

  // ---------- Index de recherche ----------
  const index = D.protocoles.map((p) => ({
    p,
    titre: norm(`${p.t} ${p.c}`),
    mots: norm(`${p.m} ${p.g} ${p.r}`),
    rub: p.k.map((k) => ({ titre: norm(k.t), texte: norm(k.x), brut: k.x.normalize('NFC') })),
  }));

  function chercher(requete) {
    const jetons = norm(requete).split(/[\s,;]+/).filter((j) => j.length >= 2 || /\d/.test(j));
    if (!jetons.length) return { jetons, liste: [] };
    const liste = [];
    for (const e of index) {
      let score = 0;
      let complet = true;
      const parRub = e.rub.map(() => 0);
      for (const j of jetons) {
        let vu = false;
        if (e.titre.includes(j)) { score += 12; vu = true; }
        if (e.mots.includes(j)) { score += 5; vu = true; }
        e.rub.forEach((r, i) => {
          if (r.titre.includes(j)) { score += 3; parRub[i] += 3; vu = true; }
          if (r.texte.includes(j)) { score += 1; parRub[i] += 1; vu = true; }
        });
        if (!vu) { complet = false; break; }
      }
      if (!complet) continue;
      const rubs = parRub
        .map((s, i) => ({ s, i }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s || a.i - b.i)
        .slice(0, 3)
        .map(({ i }) => ({ i, extrait: extrait(e.rub[i], jetons) }));
      liste.push({ p: e.p, score, rubs });
    }
    liste.sort((a, b) => b.score - a.score);
    return { jetons, liste };
  }

  function extrait(rub, jetons) {
    let pos = -1;
    for (const j of jetons) {
      const i = rub.texte.indexOf(j);
      if (i >= 0 && (pos < 0 || i < pos)) pos = i;
    }
    if (pos < 0) pos = 0;
    let debut = Math.max(0, pos - 50);
    const esp = rub.brut.indexOf(' ', debut);
    if (debut > 0 && esp >= 0 && esp < pos) debut = esp + 1;
    const fin = Math.min(rub.brut.length, debut + 150);
    const brut = rub.brut.slice(debut, fin);
    const n = normLongueur(brut);
    // Surlignage : mêmes positions dans le texte normalisé et dans le texte d'origine.
    const marques = [];
    for (const j of jetons) {
      let i = 0;
      while ((i = n.indexOf(j, i)) >= 0) { marques.push([i, i + j.length]); i += j.length; }
    }
    marques.sort((a, b) => a[0] - b[0]);
    let html = '';
    let c = 0;
    for (const [a, b] of marques) {
      if (a < c) continue;
      html += `${esc(brut.slice(c, a))}<mark>${esc(brut.slice(a, b))}</mark>`;
      c = b;
    }
    html += esc(brut.slice(c));
    return `${debut > 0 ? '… ' : ''}${html}${fin < rub.brut.length ? ' …' : ''}`;
  }

  // ---------- Morceaux d'interface ----------
  function carte(p, options = {}) {
    const fav = favoris.includes(p.id) ? ic('star', 'carte-fav') : '';
    const sous = options.avecSection ? `${sectionDe.get(p.s).court} · ${p.g}` : p.r;
    return `<a class="carte s-${p.s}" href="#${p.id}"><span class="carte-ic">${ic(p.i)}</span><span class="carte-txt"><strong>${esc(p.t)}</strong><span>${esc(sous)}</span></span>${fav}${ic('chevron-right')}</a>`;
  }
  const puce = (p) => `<a class="puce s-${p.s}" href="#${p.id}">${ic(p.i)}${esc(p.c)}</a>`;

  function vueAccueil() {
    const portes = D.sections
      .map((s) => {
        const n = D.protocoles.filter((p) => p.s === s.id).length;
        return `<a class="porte porte-${s.id}" href="#${s.id}"><span class="porte-ic">${ic(s.id)}</span><div><h2>${esc(s.titre)}</h2><p>${esc(s.accroche)}</p></div><span class="porte-bas"><span>${pluriel(n, 'fiche')}</span>${ic('chevron-right')}</span></a>`;
      })
      .join('');
    const blocFav = favoris.length
      ? `<section class="bloc"><div class="bloc-titre"><h2>${ic('star')} Favoris</h2><span class="compte">${favoris.length}</span></div><div class="cartes">${favoris.map((id) => carte(parId.get(id), { avecSection: true })).join('')}</div></section>`
      : '';
    const blocRecents = recents.length
      ? `<section class="bloc"><div class="bloc-titre"><h2>${ic('history')} Consultés récemment</h2></div><div class="puces">${recents.map((id) => puce(parId.get(id))).join('')}</div></section>`
      : '';
    vue.className = 'vue';
    vue.innerHTML = `
      <section class="intro">
        <p class="eyebrow">${esc(D.meta.service)} · ${esc(D.meta.version)}</p>
        <h1>${esc(D.meta.titre)}</h1>
        <p>${esc(D.meta.sousTitre)} — ${pluriel(D.protocoles.length, 'fiche')}, recherche plein texte, pages du livret consultables.</p>
      </section>
      <nav class="portes" aria-label="Sections">${portes}</nav>
      ${blocFav}
      <section class="bloc"><div class="bloc-titre"><h2>${ic('zap')} Accès rapide</h2></div><div class="puces">${D.acces.map((id) => puce(parId.get(id))).join('')}</div></section>
      ${blocRecents}`;
    document.title = D.meta.titre;
  }

  function vueSection(s) {
    const fiches = D.protocoles.filter((p) => p.s === s.id);
    const groupes = s.groupes.map((g) => ({ g, fiches: fiches.filter((p) => p.g === g) })).filter((x) => x.fiches.length);
    vue.className = `vue s-${s.id}`;
    vue.innerHTML = `
      <div class="tete"><div class="tete-ic">${ic(s.id)}</div><div><h1>${esc(s.titre)}</h1><p>${pluriel(fiches.length, 'fiche')} · ${esc(s.accroche)}</p></div></div>
      <nav class="bascule" aria-label="Section">${D.sections.map((x) => `<a href="#${x.id}"${x.id === s.id ? ' aria-current="page"' : ''}>${esc(x.titre)}</a>`).join('')}</nav>
      <div class="puces" role="navigation" aria-label="Groupes">${groupes.map((x, i) => `<button type="button" class="puce" data-groupe="${i}">${esc(x.g)}</button>`).join('')}</div>
      ${groupes
        .map((x, i) => `<section class="bloc" data-bloc="${i}"><div class="bloc-titre"><h2>${esc(x.g)}</h2><span class="compte">${pluriel(x.fiches.length, 'fiche')}</span></div><div class="cartes">${x.fiches.map((p) => carte(p)).join('')}</div></section>`)
        .join('')}`;
    document.title = `${s.titre} · ${D.meta.titre}`;
  }

  const ouvertes = new Map(); // fiche -> rubriques dépliées (conservé pendant la session)
  let cibleRubrique = null; // { id, i } : rubrique à ouvrir en arrivant depuis la recherche

  function vueFiche(p) {
    const s = sectionDe.get(p.s);
    const memes = D.protocoles.filter((x) => x.s === p.s);
    const rang = memes.indexOf(p);
    const prec = memes[rang - 1];
    const suiv = memes[rang + 1];
    let etat = ouvertes.get(p.id);
    if (!etat) {
      etat = new Set(p.k.length <= 2 ? p.k.map((_, i) => i) : []);
      ouvertes.set(p.id, etat);
    }
    if (cibleRubrique && cibleRubrique.id === p.id) etat.add(cibleRubrique.i);
    const fav = favoris.includes(p.id);
    const plage = p.p.length > 1 ? `p. ${p.p[0]}–${p.p[p.p.length - 1]}` : `p. ${p.p[0]}`;
    vue.className = `vue s-${p.s}`;
    vue.innerHTML = `
      <nav class="fil" aria-label="Fil d’Ariane"><a href="#${s.id}">${esc(s.titre)}</a>${ic('chevron-right')}<span>${esc(p.g)}</span></nav>
      <header class="fiche-tete">
        <div class="fiche-titre"><span class="carte-ic">${ic(p.i)}</span><h1>${esc(p.t)}</h1></div>
        ${p.r ? `<p class="fiche-resume">${esc(p.r)}</p>` : ''}
        <div class="outils">
          <button type="button" class="outil" id="btn-fav" aria-pressed="${fav}">${ic('star')}<span>${fav ? 'Favori' : 'Ajouter aux favoris'}</span></button>
          ${p.k.length > 1 ? `<button type="button" class="outil" id="btn-tout">${ic('chevrons-up-down')}<span>Tout déplier</span></button>` : ''}
          <button type="button" class="outil" data-page="${p.p[0]}">${ic('book-open')}<span>Livret ${plage}</span></button>
        </div>
      </header>
      <div class="rubriques">
        ${p.k
          .map((k, i) => `<details class="rub" data-i="${i}"${etat.has(i) ? ' open' : ''}><summary><span class="rub-ic">${ic(k.i)}</span><span class="rub-titre">${esc(k.t)}</span>${ic('chevron-down', 'rub-chevron')}</summary><div class="rub-corps prose">${k.h}</div></details>`)
          .join('')}
      </div>
      <section class="bloc sources">
        <div class="bloc-titre"><h2>Pages du livret</h2><span class="compte">${esc(D.meta.version)}</span></div>
        <p>En cas de doute sur une valeur, ouvrir la page d’origine : c’est elle qui fait foi.</p>
        <div class="pages">${p.p.map((n) => `<button type="button" class="page-btn" data-page="${n}">p. ${n}</button>`).join('')}</div>
      </section>
      <nav class="voisins" aria-label="Fiches voisines">
        ${prec ? `<a class="voisin" href="#${prec.id}"><small>← Précédente</small><strong>${esc(prec.c)}</strong></a>` : ''}
        ${suiv ? `<a class="voisin suivant" href="#${suiv.id}"><small>Suivante →</small><strong>${esc(suiv.c)}</strong></a>` : ''}
      </nav>`;
    document.title = `${p.c} · ${D.meta.titre}`;
    majToutDeplier(p);
    recents = [p.id, ...recents.filter((id) => id !== p.id)].slice(0, 6);
    memoire.ecrire('nar-recents', recents);
  }

  function majToutDeplier(p) {
    const b = $('btn-tout');
    if (!b) return;
    const tout = ouvertes.get(p.id).size === p.k.length;
    b.dataset.tout = tout ? '1' : '';
    b.innerHTML = `${ic(tout ? 'chevrons-down-up' : 'chevrons-up-down')}<span>${tout ? 'Tout replier' : 'Tout déplier'}</span>`;
  }

  function vueRecherche() {
    const q = champ.value.trim();
    vue.className = 'vue';
    document.title = `Recherche · ${D.meta.titre}`;
    if (!q) {
      vue.innerHTML = `<div class="vide"><strong>Rechercher dans les ${D.protocoles.length} fiches</strong>Un médicament, un score, un sigle : « milrinone », « INR », « jeûne », « cell-index »…</div>`;
      return;
    }
    const { liste } = chercher(q);
    if (!liste.length) {
      vue.innerHTML = `<div class="bloc-titre"><h2>Aucun résultat pour « ${esc(q)} »</h2></div><div class="vide"><strong>Rien trouvé</strong>Essayer un autre terme ou un sigle (DCI plutôt que nom commercial, ou l’inverse).</div>`;
      return;
    }
    vue.innerHTML = `
      <div class="bloc-titre"><h2>${pluriel(liste.length, 'fiche')} pour « ${esc(q)} »</h2></div>
      <div class="resultats">${liste
        .map(({ p, rubs }) => `<div class="res s-${p.s}"><a class="res-tete" href="#${p.id}"><span class="carte-ic">${ic(p.i)}</span><div><strong>${esc(p.t)}</strong><small>${esc(sectionDe.get(p.s).titre)} · ${esc(p.g)}</small></div>${ic('chevron-right')}</a>${rubs
          .map((r) => `<a class="res-rub" href="#${p.id}" data-rub="${r.i}"><b>${esc(p.k[r.i].t)}</b><span>${r.extrait}</span></a>`)
          .join('')}</div>`)
        .join('')}</div>`;
  }

  // ---------- Navigation (une vue par #nom) ----------
  const defilement = new Map();
  let routeCourante = null;
  let parClic = false;
  let retourRecherche = 'accueil';

  const routeDe = () => decodeURIComponent(location.hash.replace(/^#/, '')) || 'accueil';

  function afficher() {
    const r = routeDe();
    const ancienne = routeCourante;
    routeCourante = r;
    const btn = $('nav-back');
    let retour = { href: '#accueil', icone: 'house', label: 'Accueil' };
    if (r === 'recherche') {
      vueRecherche();
      retour = { href: `#${retourRecherche}`, icone: 'arrow-left', label: 'Quitter la recherche' };
    } else if (sectionDe.has(r)) {
      vueSection(sectionDe.get(r));
    } else if (parId.has(r)) {
      const p = parId.get(r);
      vueFiche(p);
      retour = { href: `#${p.s}`, icone: 'arrow-left', label: `Retour à ${sectionDe.get(p.s).titre}` };
    } else {
      vueAccueil();
    }
    btn.setAttribute('href', retour.href);
    btn.setAttribute('aria-label', retour.label);
    btn.innerHTML = ic(retour.icone);

    const cible = cibleRubrique && cibleRubrique.id === r ? vue.querySelector(`.rub[data-i="${cibleRubrique.i}"]`) : null;
    cibleRubrique = null;
    if (cible) {
      cible.classList.add('cible');
      requestAnimationFrame(() => cible.scrollIntoView({ block: 'start' }));
      setTimeout(() => cible.classList.remove('cible'), 2200);
    } else if (parClic || ancienne === null) {
      window.scrollTo(0, 0);
    } else {
      const y = defilement.get(r) || 0;
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
    parClic = false;
  }

  function aller(route) {
    parClic = true;
    if (routeDe() === route) afficher();
    else location.hash = route;
  }

  window.addEventListener('hashchange', afficher);
  let attenteDefilement = 0;
  window.addEventListener('scroll', () => {
    if (attenteDefilement) return;
    attenteDefilement = requestAnimationFrame(() => {
      attenteDefilement = 0;
      if (routeCourante) defilement.set(routeCourante, window.scrollY);
    });
  }, { passive: true });

  // ---------- Recherche ----------
  let minuterie = 0;
  function majRecherche() {
    $('q-clear').hidden = !champ.value;
    clearTimeout(minuterie);
    minuterie = setTimeout(() => {
      if (champ.value.trim()) {
        if (routeCourante !== 'recherche') {
          retourRecherche = routeCourante || 'accueil';
          aller('recherche');
        } else {
          vueRecherche();
          window.scrollTo(0, 0);
        }
      } else if (routeCourante === 'recherche') {
        aller(retourRecherche);
      }
    }, 110);
  }
  champ.addEventListener('input', majRecherche);
  $('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    champ.blur();
  });
  $('q-clear').addEventListener('click', () => {
    champ.value = '';
    majRecherche();
    champ.focus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) && $('lightbox').hidden) {
      e.preventDefault();
      champ.focus();
      champ.select();
    }
  });

  // ---------- Clics délégués ----------
  document.addEventListener('click', (e) => {
    const lien = e.target.closest('a[href^="#"]');
    if (lien) {
      parClic = true;
      const rub = lien.dataset.rub;
      const id = lien.getAttribute('href').slice(1);
      if (rub !== undefined) cibleRubrique = { id, i: Number(rub) };
      if (routeDe() === id) {
        e.preventDefault();
        afficher();
      }
      return;
    }
    const zoom = e.target.closest('[data-zoom]');
    if (zoom) return ouvrirImage(zoom.dataset.zoom, zoom.dataset.legende, null);
    const page = e.target.closest('[data-page]');
    if (page) return ouvrirPage(Number(page.dataset.page));
    const copie = e.target.closest('[data-copy]');
    if (copie) return copier(copie.dataset.copy);
    const groupe = e.target.closest('[data-groupe]');
    if (groupe) {
      const bloc = vue.querySelector(`[data-bloc="${groupe.dataset.groupe}"]`);
      if (bloc) bloc.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    if (e.target.closest('#btn-fav')) return basculerFavori();
    if (e.target.closest('#btn-tout')) return toutDeplier();
  });

  vue.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!d.classList || !d.classList.contains('rub')) return;
    const p = parId.get(routeCourante);
    if (!p) return;
    const etat = ouvertes.get(p.id);
    if (d.open) etat.add(Number(d.dataset.i));
    else etat.delete(Number(d.dataset.i));
    majToutDeplier(p);
  }, true);

  function basculerFavori() {
    const p = parId.get(routeCourante);
    if (!p) return;
    const etait = favoris.includes(p.id);
    favoris = etait ? favoris.filter((id) => id !== p.id) : [...favoris, p.id];
    memoire.ecrire('nar-favoris', favoris);
    const b = $('btn-fav');
    b.setAttribute('aria-pressed', String(!etait));
    b.querySelector('span').textContent = etait ? 'Ajouter aux favoris' : 'Favori';
    toast(etait ? 'Retiré des favoris' : 'Ajouté aux favoris');
  }

  function toutDeplier() {
    const p = parId.get(routeCourante);
    if (!p) return;
    const ouvrir = !$('btn-tout').dataset.tout;
    vue.querySelectorAll('.rub').forEach((d) => { d.open = ouvrir; });
    ouvertes.set(p.id, new Set(ouvrir ? p.k.map((_, i) => i) : []));
    majToutDeplier(p);
  }

  function copier(texte) {
    const ok = () => toast(`Copié : ${texte}`);
    try {
      navigator.clipboard.writeText(texte).then(ok, () => toast(texte));
    } catch (e) {
      toast(texte);
    }
  }

  // ---------- Visionneuse (figures et pages du livret) ----------
  const lb = $('lightbox');
  const lbImg = $('lb-img');
  const lbScroll = $('lb-scroll');
  const ZOOMS = [0, 1, 1.6, 2.4, 3.4]; // 0 = image entière à l'écran
  let lbZoom = 1;
  let lbPage = null;
  let lbHistorique = false;
  let lbFocus = null;

  function reglerZoom(z) {
    lbZoom = Math.max(0, Math.min(ZOOMS.length - 1, z));
    lbScroll.classList.toggle('ajuste', lbZoom === 0);
    lbScroll.style.setProperty('--zoom', ZOOMS[lbZoom] || 1);
    $('lb-moins').disabled = lbZoom === 0;
    $('lb-plus').disabled = lbZoom === ZOOMS.length - 1;
  }

  function ouvrirImage(src, titre, page) {
    lbPage = page;
    lbImg.src = src;
    lbImg.alt = titre || '';
    $('lb-titre').textContent = titre || '';
    $('lb-prev').hidden = $('lb-next').hidden = page === null;
    if (page !== null) {
      $('lb-prev').disabled = page <= 1;
      $('lb-next').disabled = page >= D.meta.pagesLivret;
    }
    lbScroll.scrollTo(0, 0);
    if (lb.hidden) {
      lbFocus = document.activeElement;
      reglerZoom(window.innerWidth >= 760 ? 0 : 1);
      lb.hidden = false;
      document.body.classList.add('sans-defilement');
      try {
        history.pushState({ narVisionneuse: true }, '');
        lbHistorique = true;
      } catch (e) {
        lbHistorique = false;
      }
      $('lb-fermer').focus();
    }
  }
  const ouvrirPage = (n) => ouvrirImage(`pages/p-${String(n).padStart(3, '0')}.webp`, `Livret original — page ${n} / ${D.meta.pagesLivret}`, n);

  function masquer() {
    if (lb.hidden) return;
    lb.hidden = true;
    lbImg.removeAttribute('src');
    document.body.classList.remove('sans-defilement');
    if (lbFocus && lbFocus.focus) lbFocus.focus({ preventScroll: true });
  }
  function fermer() {
    if (lbHistorique) {
      lbHistorique = false;
      history.back(); // « popstate » masquera la visionneuse
    } else masquer();
  }
  window.addEventListener('popstate', () => {
    lbHistorique = false;
    masquer();
  });
  $('lb-fermer').addEventListener('click', fermer);
  $('lb-plus').addEventListener('click', () => reglerZoom(lbZoom + 1));
  $('lb-moins').addEventListener('click', () => reglerZoom(lbZoom - 1));
  $('lb-prev').addEventListener('click', () => lbPage > 1 && ouvrirPage(lbPage - 1));
  $('lb-next').addEventListener('click', () => lbPage < D.meta.pagesLivret && ouvrirPage(lbPage + 1));
  lbScroll.addEventListener('click', (e) => { if (e.target === lbScroll) fermer(); });
  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') fermer();
    else if (e.key === '+' || e.key === '=') reglerZoom(lbZoom + 1);
    else if (e.key === '-') reglerZoom(lbZoom - 1);
    else if (e.key === 'ArrowLeft' && lbPage > 1) ouvrirPage(lbPage - 1);
    else if (e.key === 'ArrowRight' && lbPage !== null && lbPage < D.meta.pagesLivret) ouvrirPage(lbPage + 1);
  });

  // ---------- Thème ----------
  const racine = document.documentElement;
  const estSombre = () => (racine.dataset.theme ? racine.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
  const majTheme = () => $('theme-ic').setAttribute('href', estSombre() ? '#i-sun' : '#i-moon');
  const themeChoisi = memoire.lire('nar-theme', null);
  if ((themeChoisi === 'dark' || themeChoisi === 'light') && !racine.dataset.theme) racine.dataset.theme = themeChoisi;
  $('theme').addEventListener('click', () => {
    const suivant = estSombre() ? 'light' : 'dark';
    racine.dataset.theme = suivant;
    memoire.ecrire('nar-theme', suivant);
    majTheme();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', majTheme);
  new MutationObserver(majTheme).observe(racine, { attributes: true, attributeFilter: ['data-theme'] });
  majTheme();

  // ---------- Démarrage ----------
  $('pied-preambule').textContent = D.meta.preambule;
  $('pied-meta').textContent = `${D.meta.service} · ${D.meta.version} · application générée le ${D.meta.genere}`;
  afficher();

  // Hors-ligne : uniquement pour le site autonome (pas dans un cadre intégré).
  let autonome = false;
  try { autonome = window.top === window; } catch (e) { autonome = false; }
  if (autonome && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
