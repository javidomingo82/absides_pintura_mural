# Ábsides · Pintura mural románica en 3D

A responsive, Spanish-language digital gallery for the two public Sketchfab
collections by **Javier Domingo Ballestin**. All 50 models are catalogued:
26 ábsides and 24 conjuntos. Models open in an accessible modal with Sketchfab's
interactive viewer, previous/next navigation, and a direct source link.

Intended website: https://javidomingo82.github.io/absides_pintura_mural/

## Preview locally

No build, package installation, account or API key is required.

```sh
python3 -m http.server 8080
```

Open http://localhost:8080. An internet connection is needed for the interactive
Sketchfab viewers and Google Fonts; system fonts provide an offline fallback.
Preview images and the catalog are stored locally.

## Publish to GitHub Pages

A repository administrator must open **Settings → Pages → Build and deployment**
and select **GitHub Actions** as the source. Then run **Actions → Deploy gallery
to GitHub Pages → Run workflow**, or push a change to `main`.

The workflow publishes only the website files and `assets/`. Project instructions,
scripts, this README, and local noomix data are excluded from the deployment.

The repository is private. Private-repository Pages requires an eligible paid
GitHub plan. An administrator can instead make the repository public if the owner
approves. The website itself is intended to be publicly accessible. Do not change
repository visibility without the owner's approval.

## Refresh the collections

```sh
python3 scripts/update-catalog.py
```

This fetches the two public collection pages, follows pagination, checks the
reported counts, and downloads public preview images. It does not download 3D
models. Review and commit the resulting `catalog.js` and `assets/` updates to
publish them. The website uses a static snapshot, so new Sketchfab uploads appear
after this refresh; they are not fetched during a visitor's session.

## Sources and credits

- [Ábsides collection](https://sketchfab.com/jdomingoballestin/collections/absides_pintura-mural-romanica-desplazada-7eac127522b34e92b45cd5d3e76ebff7)
- [Conjuntos collection](https://sketchfab.com/jdomingoballestin/collections/conjuntos_pintura-mural-romanica-desplazada-1c0ba8edde774f7fb2195cdc5c6e93e0)
- [Javier Domingo Ballestin on Sketchfab](https://sketchfab.com/jdomingoballestin)

Collection descriptions, model names and preview images come from these sources.
Their respective creators retain their rights. Interactive models remain hosted
on Sketchfab, with the platform's attribution and controls preserved. Site copy
paraphrases the collection descriptions without adding historical claims.
