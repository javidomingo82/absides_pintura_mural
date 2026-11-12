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
    let active = null;
    const show = (spot, x, y) => {
      active?.classList.remove("is-active");
      active = spot;
      spot.classList.add("is-active");
      tip.querySelector("strong").textContent = spot.dataset.label;
      tip.querySelector("span").textContent = spot.dataset.sub;
      tip.querySelector("small")?.remove();
      if (spot.dataset.model) {
        const hint = document.createElement("small");
        hint.textContent = "Pulsa para ver el modelo 3D";
        tip.append(hint);
      }
      tip.hidden = false;
      const box = map.getBoundingClientRect();
      let left = x - box.left + 16;
      let top = y - box.top + 16;
      if (left + tip.offsetWidth > box.width - 8) left = x - box.left - tip.offsetWidth - 16;
      if (top + tip.offsetHeight > box.height - 8) top = y - box.top - tip.offsetHeight - 16;
      tip.style.left = `${Math.max(8, left)}px`;
      tip.style.top = `${Math.max(8, top)}px`;
    };
    const hide = () => {
      active?.classList.remove("is-active");
      active = null;
      tip.hidden = true;
    };
    map.addEventListener("pointermove", (event) => {
      const spot = event.target.closest(".map-hotspots circle");
      if (spot) show(spot, event.clientX, event.clientY);
      else if (event.pointerType === "mouse") hide();
    });
    map.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      const spot = event.target.closest(".map-hotspots circle");
      if (spot) show(spot, event.clientX, event.clientY);
      else hide();
    });
    map.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse") hide();
    });
    map.addEventListener("focusin", (event) => {
      const spot = event.target.closest(".map-hotspots circle");
      if (!spot) return;
      const r = spot.getBoundingClientRect();
      show(spot, r.right, r.top);
    });
    map.addEventListener("focusout", hide);
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
  const hashCollection = location.hash.slice(1);
  selectCollection(
    Object.hasOwn(collections, hashCollection) ? hashCollection : "absides",
    false,
  );
})();
