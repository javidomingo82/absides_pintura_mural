/* The catalog is a verified snapshot of the two public Sketchfab collections. */
(() => {
  "use strict";
  const { models, collections } = window.ARCHIVE;
  const $ = (selector) => document.querySelector(selector);
  const gallery = $("#gallery");
  const dialog = $("#viewer-dialog");
  const pageSize = 12;
  let collection = "absides";
  let visible = pageSize;
  let selection = [];
  let activeModel = null;
  let returnFocus = null;
  const normalize = (text) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es");
  const escape = (text) =>
    text.replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  const cube =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m8 1 6 3.5v7L8 15l-6-3.5v-7L8 1Zm0 7 6-3.5M8 8 2 4.5M8 8v7"/></svg>';

  function render() {
    const query = normalize($("#search").value.trim());
    selection = models.filter(
      (model) =>
        model.collection === collection &&
        normalize(model.name).includes(query),
    );
    selection.sort(
      $("#sort").value === "name"
        ? (a, b) => a.title.localeCompare(b.title, "es")
        : (a, b) => a.number - b.number,
    );
    gallery.innerHTML = selection
      .slice(0, visible)
      .map(
        (model) => `
      <article class="model-card">
        <button class="model-image" data-model="${model.uid}" aria-label="Explorar ${escape(model.title)} en 3D">
          <img src="${model.thumbnail}" alt="${escape(model.name)} — vista del modelo 3D" width="720" height="405" loading="lazy" decoding="async">
          <span class="model-index">${escape(model.label)}</span><span class="model-3d">${cube} EXPLORAR 3D</span>
        </button>
        <div class="model-info"><div><h3><button data-model="${model.uid}">${escape(model.title)}</button></h3><p class="model-type">${collection === "absides" ? "Pintura mural · Ábside" : "Pintura y arquitectura · Conjunto"}</p></div><button data-model="${model.uid}" aria-label="Abrir ${escape(model.title)}">↗</button></div>
      </article>`,
      )
      .join("");
    $("#result-count").textContent =
      `${selection.length} ${selection.length === 1 ? "modelo para descubrir" : "modelos para descubrir"}`;
    $("#shown-count").textContent =
      `${Math.min(visible, selection.length)} de ${selection.length} modelos`;
    $("#empty-state").hidden = selection.length > 0;
    $("#load-more").hidden = visible >= selection.length;
  }

  function selectCollection(key, updateHash = true) {
    collection = key;
    visible = pageSize;
    document.querySelectorAll("[data-collection]").forEach((tab) => {
      const active = tab.dataset.collection === collection;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    $("#collection-description").textContent = collections[collection].intro;
    $("#collection-source").href = collections[collection].url;
    if (updateHash) history.replaceState(null, "", `#${collection}`);
    render();
  }

  function openModel(uid) {
    const model = models.find((item) => item.uid === uid);
    if (!model) return;
    if (!dialog.open) returnFocus = document.activeElement;
    activeModel = model;
    $("#viewer-title").textContent = model.title;
    $("#viewer-category").textContent =
      `${model.collection === "absides" ? "ÁBSIDES" : "CONJUNTOS"} · ${model.label} · MODELO 3D`;
    $("#viewer-source").href = model.url;
    const frame = document.createElement("iframe");
    frame.title = `Visor 3D: ${model.name}`;
    frame.src = `https://sketchfab.com/models/${model.uid}/embed?autostart=1&preload=1&ui_theme=dark`;
    frame.allow = "autoplay; fullscreen; xr-spatial-tracking";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    $("#viewer-frame").replaceChildren(frame);
    const index = selection.findIndex((item) => item.uid === uid);
    $("#previous-model").disabled = index <= 0;
    $("#next-model").disabled = index < 0 || index >= selection.length - 1;
    if (!dialog.open) dialog.showModal();
  }

  document.addEventListener("click", (event) => {
    const modelButton = event.target.closest("[data-model]");
    if (modelButton) openModel(modelButton.dataset.model);
  });
  document
    .querySelectorAll("[data-collection]")
    .forEach((tab) =>
      tab.addEventListener("click", () =>
        selectCollection(tab.dataset.collection),
      ),
    );
  const map = $(".hero-map");
  const tip = $(".map-tip");
  if (map && tip) {
    const svgNS = "http://www.w3.org/2000/svg";
    const spots = [...map.querySelectorAll(".map-hotspots circle")];
    const byId = Object.fromEntries(spots.map((spot) => [spot.dataset.id, spot]));
    const links = map.querySelector(".map-links");
    const labels = document.createElement("div");
    labels.className = "map-labels";
    map.append(labels);
    const holes = map.querySelector(".map-holes");
    let locked = null;
    let pointerType = "mouse";

    const related = (spot) => {
      if (spot.dataset.museum) return [spot, byId[spot.dataset.museum]].filter(Boolean);
      return [spot, ...spots.filter((s) => s.dataset.museum === spot.dataset.id)];
    };
    const line = (from, to) => {
      const x1 = +from.getAttribute("cx"), y1 = +from.getAttribute("cy");
      const x2 = +to.getAttribute("cx"), y2 = +to.getAttribute("cy");
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const r = 60, dx = ((x2 - x1) / len) * r, dy = ((y2 - y1) / len) * r;
      for (const cls of ["map-link-halo", "map-link"]) {
        const l = document.createElementNS(svgNS, "line");
        l.setAttribute("x1", x1 + dx); l.setAttribute("y1", y1 + dy);
        l.setAttribute("x2", x2 - dx); l.setAttribute("y2", y2 - dy);
        l.setAttribute("class", cls);
        links.append(l);
      }
    };
    const highlight = (spot) => {
      links.replaceChildren();
      holes.replaceChildren();
      labels.replaceChildren();
      spots.forEach((s) => s.classList.remove("is-on"));
      map.classList.toggle("has-selection", Boolean(spot));
      if (!spot) return;
      const group = related(spot);
      group.forEach((s) => {
        s.classList.add("is-on");
        const hole = document.createElementNS(svgNS, "circle");
        hole.setAttribute("cx", s.getAttribute("cx"));
        hole.setAttribute("cy", s.getAttribute("cy"));
        hole.setAttribute("r", 64);
        hole.setAttribute("fill", "#000");
        holes.append(hole);
      });
      if (spot.dataset.museum) {
        if (group[1]) line(spot, group[1]);
      } else group.slice(1).forEach((church) => line(church, spot));
      const box = map.getBoundingClientRect();
      if (!spot.dataset.museum) return;
      group.slice(1).forEach((s) => {
        const r = s.getBoundingClientRect();
        const label = document.createElement("span");
        label.textContent = s.dataset.label;
        const right = r.right - box.left + 4;
        label.style.top = `${r.top - box.top + r.height / 2}px`;
        if (right > box.width * 0.72) {
          label.classList.add("is-left");
          label.style.right = `${box.right - r.left + 4}px`;
        } else label.style.left = `${right}px`;
        labels.append(label);
      });
    };
    const showTip = (spot, x, y) => {
      tip.replaceChildren();
      const title = document.createElement("strong");
      title.textContent = spot.dataset.label;
      tip.append(title);
      const add = (tag, text) => {
        const el = document.createElement(tag);
        el.textContent = text;
        tip.append(el);
      };
      if (spot.dataset.km) add("span", `${spot.dataset.km} km`);
      else if (!spot.dataset.museum && spot.dataset.sub) add("span", spot.dataset.sub);
      if (!spot.dataset.museum) {
        const churches = spots
          .filter((s) => s.dataset.museum === spot.dataset.id)
          .sort((x, y) => x.dataset.id.localeCompare(y.dataset.id));
        if (churches.length) {
          const list = document.createElement("ul");
          churches.forEach((s) => {
            const li = document.createElement("li");
            li.textContent = s.dataset.km
              ? `${s.dataset.label} · ${s.dataset.km} km`
              : s.dataset.label;
            list.append(li);
          });
          tip.append(list);
        }
      }
      if (spot.dataset.model) add("small", "Pulsa para ver el modelo 3D");
      tip.hidden = false;
      const box = map.getBoundingClientRect();
      if (!spot.dataset.museum) {
        // Museos: la lista va en la esquina inferior izquierda para no tapar las iglesias
        tip.style.left = "16px";
        tip.style.top = `${Math.max(8, box.height - tip.offsetHeight - 16)}px`;
        return;
      }
      let left = x - box.left + 16;
      let top = y - box.top + 16;
      if (left + tip.offsetWidth > box.width - 8) left = x - box.left - tip.offsetWidth - 16;
      if (top + tip.offsetHeight > box.height - 8) top = y - box.top - tip.offsetHeight - 16;
      tip.style.left = `${Math.max(8, left)}px`;
      tip.style.top = `${Math.max(8, top)}px`;
    };
    const rest = () => {
      tip.hidden = true;
      highlight(locked);
    };

    map.addEventListener("pointerdown", (event) => {
      pointerType = event.pointerType;
    });
    map.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      const spot = event.target.closest(".map-hotspots circle");
      if (spot) {
        showTip(spot, event.clientX, event.clientY);
        highlight(spot);
      } else rest();
    });
    map.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse") rest();
    });
    map.addEventListener("click", (event) => {
      const spot = event.target.closest(".map-hotspots circle");
      if (!spot) {
        if (event.target.closest(".hero-map-zoom")) return;
        locked = null;
        rest();
        return;
      }
      const firstTouch = pointerType !== "mouse" && locked !== spot;
      locked = spot;
      highlight(spot);
      showTip(spot, event.clientX, event.clientY);
      // En pantallas táctiles, el primer toque sólo selecciona; el segundo abre el modelo
      if (firstTouch) event.stopPropagation();
    });
    map.addEventListener("focusin", (event) => {
      const spot = event.target.closest(".map-hotspots circle");
      if (!spot) return;
      const r = spot.getBoundingClientRect();
      showTip(spot, r.right, r.top);
      highlight(spot);
    });
    map.addEventListener("focusout", rest);
    map.addEventListener("keydown", (event) => {
      const spot = event.target.closest(".map-hotspots circle[data-model]");
      if (spot && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openModel(spot.dataset.model);
      }
    });
  }
  $("#search").addEventListener("input", () => {
    visible = pageSize;
    render();
  });
  $("#sort").addEventListener("change", () => {
    visible = pageSize;
    render();
  });
  $("#clear-search").addEventListener("click", () => {
    $("#search").value = "";
    render();
    $("#search").focus();
  });
  $("#load-more").addEventListener("click", () => {
    const firstNewIndex = Math.min(visible, selection.length);
    visible += pageSize;
    render();
    gallery.children[firstNewIndex]
      ?.querySelector("button")
      ?.focus({ preventScroll: true });
  });
  $("#close-viewer").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      dialog.close();
  });
  dialog.addEventListener("close", () => {
    $("#viewer-frame").replaceChildren();
    activeModel = null;
    returnFocus?.focus({ preventScroll: true });
  });
  for (const [selector, offset] of [
    ["#previous-model", -1],
    ["#next-model", 1],
  ]) {
    $(selector).addEventListener("click", () => {
      const index = selection.findIndex(
        (item) => item.uid === activeModel?.uid,
      );
      if (index >= 0 && selection[index + offset])
        openModel(selection[index + offset].uid);
    });
  }
  const museumDialog = $("#museum-dialog");
  const museums = window.MUSEOS || {};
  function openMuseum(letter, updateHash = true) {
    const museum = museums[letter];
    if (!museum || !museumDialog) return;
    $("#museum-letter").textContent = letter;
    $("#museum-eyebrow").textContent = `MUSEO · TESIS, APARTADO ${museum.section}`;
    $("#museum-title").textContent = museum.name;
    $("#museum-place").textContent = museum.place;
    const photo = $("#museum-photo");
    photo.replaceChildren();
    if (museum.photo) {
      const img = document.createElement("img");
      img.src = `./assets/museos/${museum.photo}`;
      img.alt = `Exterior del ${museum.name}`;
      img.loading = "lazy";
      photo.append(img);
      if (museum.credit) {
        const cap = document.createElement("figcaption");
        cap.textContent = `Fotografía: ${museum.credit}`;
        photo.append(cap);
      }
    } else {
      const ph = document.createElement("div");
      ph.className = "museum-photo-pending";
      ph.textContent = "Fotografía del exterior pendiente";
      photo.append(ph);
    }
    $("#museum-text").replaceChildren(
      ...museum.text.map((paragraph) => {
        const p = document.createElement("p");
        p.textContent = paragraph;
        return p;
      }),
    );
    const plan = $("#museum-plan");
    plan.replaceChildren();
    const link = document.createElement("a");
    link.href = `./assets/museos/${museum.plan}`;
    link.target = "_blank";
    link.rel = "noopener";
    const planImg = document.createElement("img");
    planImg.src = `./assets/museos/${museum.plan}`;
    planImg.alt = `Plano del ${museum.name} con la disposición de los ábsides`;
    planImg.loading = "lazy";
    link.append(planImg);
    const planCap = document.createElement("figcaption");
    planCap.textContent = "Museografía: disposición de los ábsides. Elaboración propia.";
    plan.append(link, planCap);
    const card = document.querySelector(`[data-museum-open="${letter}"]`)?.closest(".museum-card");
    $("#museum-sets").replaceChildren(
      ...[...(card?.querySelectorAll("li") || [])].map((li) => li.cloneNode(true)),
    );
    $("#museum-source").textContent =
      "Texto resumido del capítulo 7 de la tesis doctoral «Conjuntos absidiales de pintura mural románica desplazada».";
    if (updateHash) history.replaceState(null, "", `#museo-${museum.slug}`);
    if (!museumDialog.open) museumDialog.showModal();
    museumDialog.scrollTop = 0;
  }
  document.querySelectorAll("[data-museum-open]").forEach((button) =>
    button.addEventListener("click", () => openMuseum(button.dataset.museumOpen)),
  );
  $("#close-museum")?.addEventListener("click", () => museumDialog.close());
  museumDialog?.addEventListener("click", (event) => {
    if (event.target !== museumDialog) return;
    const b = museumDialog.getBoundingClientRect();
    if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom)
      museumDialog.close();
  });
  museumDialog?.addEventListener("close", () => {
    if (location.hash.startsWith("#museo-"))
      history.replaceState(null, "", "#museos");
  });
  const hashCollection = location.hash.slice(1);
  selectCollection(
    Object.hasOwn(collections, hashCollection) ? hashCollection : "absides",
    false,
  );
  if (hashCollection.startsWith("museo-")) {
    const slug = hashCollection.slice(6);
    const letter = Object.keys(museums).find((key) => museums[key].slug === slug);
    if (letter) openMuseum(letter, false);
  }
})();
