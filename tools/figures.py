#!/usr/bin/env python3
"""Extrait du livret PDF les figures (algorithmes, tableaux complexes) et les pages originales.

Usage :
    python3 tools/figures.py chemin/vers/Protocoles_NAR.pdf

Dépendances : poppler-utils (pdftoppm) et Pillow.
Sorties :
    docs/figures/<nom>.webp   figures recadrées, insérées dans les protocoles
    docs/pages/p-NNN.webp     pages du livret, pour la vérification « page originale »

Chaque figure est définie par : page, puis cadre (x0, y0, x1, y1) en fraction de la page.
Le cadre est ensuite resserré automatiquement sur le contenu (suppression des marges blanches).
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT_FIG = ROOT / "docs" / "figures"
OUT_PAGES = ROOT / "docs" / "pages"

FULL = (0.0, 0.0, 1.0, 1.0)

FIGURES = {
    # --- Réanimation ---
    "hsa-tdm-negative": (11, (0.26, 0.105, 0.76, 0.785)),
    "htic-algo": (13, (0.0, 0.06, 1.0, 0.90)),
    "vasospasme-algo": (18, FULL),
    "levosimendan": (19, FULL),
    "meningite-algo": (26, (0.0, 0.10, 1.0, 0.93)),
    "ilc-diagnostic": (30, (0.0, 0.16, 1.0, 0.60)),
    "ilc-prise-en-charge": (31, (0.0, 0.065, 1.0, 0.97)),
    "candidose-algo": (34, (0.04, 0.555, 0.96, 0.86)),
    "hyponatremie-algo": (42, (0.0, 0.075, 1.0, 0.685)),
    "eme-algo": (43, (0.0, 0.065, 1.0, 0.98)),
    "ett-choc-algo": (45, (0.0, 0.03, 1.0, 0.97)),
    "avc-thrombolyse-aod": (51, (0.04, 0.37, 0.96, 0.80)),
    "avc-bilan-etiologique": (53, (0.0, 0.125, 1.0, 0.487)),
    "avc-prevention-1": (53, (0.0, 0.52, 1.0, 0.93)),
    "avc-prevention-2": (54, FULL),
    "avc-prevention-3": (55, FULL),
    "avc-prevention-4": (56, FULL),
    "avk-has-2008": (57, (0.0, 0.305, 1.0, 0.70)),
    "aod-hic-algo": (58, (0.0, 0.495, 1.0, 0.92)),
    "aap-hemorragie-algo": (59, (0.0, 0.135, 1.0, 0.47)),
    "eer-1": (61, (0.0, 0.12, 1.0, 0.88)),
    "eer-2": (62, FULL),
    "eer-3": (63, FULL),
    "ipp-bmj": (64, (0.0, 0.21, 1.0, 0.615)),
    "pmo-fiche": (66, (0.0, 0.115, 1.0, 0.88)),
    # --- Anesthésie ---
    "coronarien-algo": (73, (0.0, 0.14, 1.0, 0.75)),
    "aod-antagonisation": (77, (0.0, 0.47, 1.0, 0.785)),
    "aod-hemorragie-gravite": (78, (0.0, 0.125, 1.0, 0.475)),
    "alif-ecarteurs": (86, (0.2, 0.555, 0.8, 0.735)),
    "pbm-organisation": (88, (0.0, 0.135, 1.0, 0.835)),
    "diabete-generalites": (94, FULL),
    "diabete-preop": (95, FULL),
    "diabete-sglt2": (96, FULL),
    "diabete-hyperglycemie": (97, FULL),
    "diabete-hypoglycemie": (98, FULL),
    "diabete-ivse": (99, FULL),
    "diabete-relais": (100, FULL),
    "diabete-basal-bolus": (101, FULL),
    "diabete-reprise": (102, FULL),
    "diabete-courte-duree": (103, FULL),
}

FIG_DPI = 200
PAGE_DPI = 140

# Zones masquées avant toute extraction (version publique) : noms, numéros de poste,
# adresse électronique, logos. page -> cadres (x0, y0, x1, y1) en fraction de la page.
MASQUES = {
    1: [(0.08, 0.075, 0.92, 0.185)],
    5: [(0.1597, 0.3496, 0.7199, 0.6757), (0.1593, 0.7431, 0.8264, 0.9032)],
    6: [(0.2072, 0.2813, 0.7771, 0.4096)],
    28: [(0.7825, 0.5501, 0.8645, 0.5679), (0.1147, 0.5646, 0.4376, 0.5824)],
    66: [(0.118, 0.122, 0.30, 0.168), (0.37, 0.396, 0.64, 0.42)],
    69: [(0.6919, 0.561, 0.7509, 0.5812)],
    87: [(0.4867, 0.3944, 0.546, 0.4134)],
    88: [(0.124, 0.6136, 0.1947, 0.6338)],
    91: [
        (0.3628, 0.7678, 0.4221, 0.7879),
        (0.612, 0.7879, 0.671, 0.8081),
        (0.5922, 0.8078, 0.6512, 0.828),
        (0.5574, 0.8277, 0.6164, 0.8479),
        (0.2527, 0.8678, 0.312, 0.888),
        (0.4771, 0.888, 0.5365, 0.9082),
    ],
    92: [(0.2336, 0.2302, 0.2959, 0.2504)],
}
COULEUR_MASQUE = (214, 220, 228)


def render(pdf: Path, page: int, dpi: int, tmp: Path) -> Image.Image:
    prefix = tmp / f"r{dpi}-{page}"
    subprocess.run(
        ["pdftoppm", "-r", str(dpi), "-f", str(page), "-l", str(page), "-png", "-singlefile", str(pdf), str(prefix)],
        check=True,
    )
    im = Image.open(f"{prefix}.png").convert("RGB")
    w, h = im.size
    for x0, y0, x1, y1 in MASQUES.get(page, []):
        ImageDraw.Draw(im).rectangle((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)), fill=COULEUR_MASQUE)
    return im


def trim(im: Image.Image, pad: int = 18) -> Image.Image:
    bg = Image.new("RGB", im.size, (255, 255, 255))
    diff = ImageChops.difference(im, bg).convert("L").point(lambda v: 255 if v > 14 else 0)
    box = diff.getbbox()
    if not box:
        return im
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(im.width, x1 + pad), min(im.height, y1 + pad)
    return im.crop((x0, y0, x1, y1))


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    pdf = Path(sys.argv[1])
    OUT_FIG.mkdir(parents=True, exist_ok=True)
    OUT_PAGES.mkdir(parents=True, exist_ok=True)
    n_pages = int(
        next(
            line.split()[1]
            for line in subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True, check=True).stdout.splitlines()
            if line.startswith("Pages:")
        )
    )
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        cache = {}
        for name, (page, (fx0, fy0, fx1, fy1)) in FIGURES.items():
            if page not in cache:
                cache[page] = render(pdf, page, FIG_DPI, tmp)
            im = cache[page]
            w, h = im.size
            crop = trim(im.crop((int(fx0 * w), int(fy0 * h), int(fx1 * w), int(fy1 * h))))
            crop.save(OUT_FIG / f"{name}.webp", "WEBP", quality=84, method=6)
            print(f"figure {name}: p.{page} -> {crop.size}")
        for page in range(1, n_pages + 1):
            im = render(pdf, page, PAGE_DPI, tmp)
            im.save(OUT_PAGES / f"p-{page:03d}.webp", "WEBP", quality=72, method=6)
        print(f"{n_pages} pages -> {OUT_PAGES}")


if __name__ == "__main__":
    main()
