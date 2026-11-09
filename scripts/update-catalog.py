#!/usr/bin/env python3
"""Refresh the public Sketchfab collections, including every pagination page.

No Sketchfab credentials or API keys are required. Only metadata and public
preview images are saved; 3D models remain hosted on Sketchfab.
"""
import concurrent.futures
import datetime
import html
import json
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent
PROFILE = "https://sketchfab.com/jdomingoballestin/collections"
COLLECTIONS = {
    "absides": {
        "uid": "7eac127522b34e92b45cd5d3e76ebff7",
        "slug": "absides_pintura-mural-romanica-desplazada",
        "intro": "Pintura mural absidial digitalizada: descubre las instalaciones museísticas de estas pinturas románicas desplazadas.",
    },
    "conjuntos": {
        "uid": "1c0ba8edde774f7fb2195cdc5c6e93e0",
        "slug": "conjuntos_pintura-mural-romanica-desplazada",
        "intro": "La pintura vuelve a su contexto: explora los conjuntos murales vinculados con la planta arquitectónica de sus edificios de origen.",
    },
}
HERO_UID = "a9b76579120f4558895b7e78b123d909"


def fetch(url):
    if not url.startswith(("https://sketchfab.com/", "https://media.sketchfab.com/")):
        raise ValueError("Unexpected source URL")
    return subprocess.run(
        ["curl", "--fail", "--location", "--silent", "--show-error", "--max-time", "45", "--retry", "2", url],
        check=True, capture_output=True,
    ).stdout


def prefetched(content):
    match = re.search(r'id="js-dom-data-prefetched-data"><!--(.*?)-->', content.decode(), re.S)
    if not match:
        raise ValueError("Sketchfab page format changed; the existing catalog was preserved")
    return json.loads(html.unescape(match.group(1)))


def main():
    models, downloads = [], []
    collections = {}
    for key, config in COLLECTIONS.items():
        url = f"{PROFILE}/{config['slug']}-{config['uid']}"
        data = prefetched(fetch(url))
        metadata = data[f"/i/collections/{config['uid']}"]
        collections[key] = {"uid": config["uid"], "name": metadata["name"], "description": metadata["description"], "intro": config["intro"], "url": url, "count": metadata["modelCount"]}
        page = next(value for endpoint, value in data.items() if endpoint.startswith(f"/i/collections/{config['uid']}/models?"))
        items, visited = [], set()
        while True:
            items.extend(page["results"])
            if not page.get("next"):
                break
            if page["next"] in visited:
                raise ValueError("Repeated pagination cursor")
            visited.add(page["next"])
            page = json.loads(fetch(page["next"]))
        if len(items) != metadata["modelCount"] or len({item["uid"] for item in items}) != len(items):
            raise ValueError(f"Incomplete collection: {key}; the existing catalog was preserved")
        for item in items:
            if not re.fullmatch(r"[a-f0-9]{32}", item["uid"]):
                raise ValueError("Invalid model identifier")
            match = re.match(r"(\d+(?:/\d+)?)\s+(.+)", item["name"])
            label, name = (match.group(1), match.group(2)) if match else ("—", item["name"])
            title = re.sub(r"^(?:Ábside(?: central| meridional)?|Absidiolo(?: meridional)?|Conjunto)\s+(?:de |del )?", "", name, flags=re.I)
            thumbnail = min(item["thumbnails"]["images"], key=lambda image: abs(image["width"] - 720))
            path = f"assets/thumbnails/{item['uid']}.jpg"
            models.append({"uid": item["uid"], "collection": key, "name": item["name"], "title": title, "label": label, "number": int(label.split('/')[0]) if match else 999, "url": item["viewerUrl"], "thumbnail": f"./{path}", "thumbnailSource": thumbnail["url"]})
            downloads.append((path, thumbnail["url"]))
            if item["uid"] == HERO_UID:
                downloads.append(("assets/hero.jpg", max(item["thumbnails"]["images"], key=lambda image: image["width"])["url"]))
    with tempfile.TemporaryDirectory(prefix="absides-catalog-") as temporary:
        staging = Path(temporary)

        def download(entry):
            path, url = entry
            destination = staging / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            content = fetch(url)
            if not content.startswith(b"\xff\xd8"):
                raise ValueError(f"Invalid JPEG: {path}")
            destination.write_bytes(content)

        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            list(executor.map(download, downloads))
        catalog = {"updatedAt": datetime.datetime.now(datetime.timezone.utc).date().isoformat(), "source": PROFILE, "author": "Javier Domingo Ballestin", "collections": collections, "models": models}
        serialized = "window.ARCHIVE = " + json.dumps(catalog, ensure_ascii=False, indent=2) + ";\n"
        for path, _ in downloads:
            destination = ROOT / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes((staging / path).read_bytes())
        (ROOT / "catalog.js").write_text(serialized, encoding="utf-8")
    print(f"Updated {len(models)} models in {len(collections)} collections; all collection counts verified.")


if __name__ == "__main__":
    main()
