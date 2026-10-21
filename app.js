// HEIC Converter: decodes photos in the browser and re-encodes them with a canvas.
(() => {
  const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const $ = (id) => document.getElementById(id);
  const drop = $("drop"), picker = $("picker"), list = $("files");
  const quality = $("quality"), qualityOut = $("quality-out"), qualityBox = $("quality-box");
  const bar = $("bar"), count = $("count"), zipBtn = $("zip"), clearBtn = $("clear");

  const items = []; // { file, li, img, status, link, blob, url, outName }
  let generation = 0; // bumps when settings change so stale conversions are dropped
  let queue = Promise.resolve();

  // Safari can't encode WebP from a canvas; hide the option there.
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  if (!probe.toDataURL("image/webp").startsWith("data:image/webp")) {
    $("f-webp").remove();
    document.querySelector('label[for="f-webp"]').remove();
  }

  const format = () => document.querySelector('input[name="format"]:checked').value;
  const lossy = () => format() !== "image/png";

  const prettySize = (n) =>
    n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

  const looksHeic = async (file) =>
    /\.(heic|heif)$/i.test(file.name) || /hei[cf]/i.test(file.type) || (await HeicTo.isHeic(file));

  async function decode(file) {
    if (await looksHeic(file)) return HeicTo({ blob: file, type: "bitmap" });
    return createImageBitmap(file);
  }

  async function encode(bitmap, type, q) {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (type === "image/jpeg") {
      // JPG has no transparency; put see-through areas on white instead of black.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0);
    try {
      return await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The browser could not encode this image."))), type, q)
      );
    } finally {
      canvas.width = canvas.height = 1; // release memory right away
    }
  }

  const baseName = (name) => name.replace(/\.[^.]+$/, "") || "photo";

  function setStatus(item, text, cls = "") {
    item.status.textContent = text;
    item.status.className = "status " + cls;
  }

  function convert(item) {
    const gen = generation;
    const type = format(), q = lossy() ? quality.value / 100 : undefined;
    item.blob = null; // so "Download all" never mixes in a copy made with old settings
    queue = queue.then(async () => {
      if (gen !== generation || !items.includes(item)) return;
      setStatus(item, "Converting…");
      item.link.setAttribute("aria-disabled", "true");
      let bitmap;
      try {
        bitmap = await decode(item.file);
        const blob = await encode(bitmap, type, q);
        if (gen !== generation || !items.includes(item)) return;
        if (item.url) URL.revokeObjectURL(item.url);
        item.blob = blob;
        item.url = URL.createObjectURL(blob);
        item.outName = `${baseName(item.file.name)}.${EXT[type]}`;
        item.img.src = item.url;
        item.link.href = item.url;
        item.link.download = item.outName;
        item.link.textContent = `Save .${EXT[type]}`;
        item.link.removeAttribute("aria-disabled");
        setStatus(item, `${prettySize(item.file.size)} → ${prettySize(blob.size)} · ${bitmap.width}×${bitmap.height}`, "ok");
      } catch (err) {
        if (gen !== generation) return;
        item.blob = null;
        setStatus(item, "Couldn't read this file — is it a photo?", "err");
        console.error(item.file.name, err);
      } finally {
        if (bitmap && bitmap.close) bitmap.close();
        refresh();
      }
    });
  }

  function add(files) {
    for (const file of files) {
      const li = document.createElement("li");
      li.className = "file";
      li.innerHTML = `<img class="thumb" alt=""><div class="meta"><div class="name"></div><div class="status">Waiting…</div></div><a class="dl" aria-disabled="true">Save</a>`;
      li.querySelector(".name").textContent = file.name;
      const item = { file, li, img: li.querySelector("img"), status: li.querySelector(".status"), link: li.querySelector("a") };
      items.push(item);
      list.append(li);
      convert(item);
    }
    refresh();
  }

  function refresh() {
    const done = items.filter((i) => i.blob).length;
    bar.hidden = items.length === 0;
    count.textContent = `${done} of ${items.length} converted`;
    zipBtn.disabled = done === 0;
  }

  function reconvertAll() {
    generation++;
    for (const item of items) convert(item);
  }

  // Inputs
  picker.addEventListener("change", () => {
    add(picker.files);
    picker.value = "";
  });
  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); })
  );
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("over")));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    add(e.dataTransfer.files);
  });
  // Dropping a file anywhere else on the page shouldn't navigate away from it.
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    if (!drop.contains(e.target)) add(e.dataTransfer.files);
  });

  // Settings
  let qualityTimer;
  quality.addEventListener("input", () => {
    qualityOut.textContent = quality.value;
    clearTimeout(qualityTimer);
    qualityTimer = setTimeout(reconvertAll, 350);
  });
  document.querySelectorAll('input[name="format"]').forEach((r) =>
    r.addEventListener("change", () => {
      qualityBox.classList.toggle("off", !lossy());
      quality.disabled = !lossy();
      reconvertAll();
    })
  );

  // Actions
  clearBtn.addEventListener("click", () => {
    generation++;
    for (const item of items) if (item.url) URL.revokeObjectURL(item.url);
    items.length = 0;
    list.replaceChildren();
    refresh();
  });

  zipBtn.addEventListener("click", async () => {
    zipBtn.disabled = true;
    const label = zipBtn.textContent;
    zipBtn.textContent = "Zipping…";
    try {
      const zip = new JSZip();
      const used = new Set();
      for (const item of items) {
        if (!item.blob) continue;
        let name = item.outName, n = 2;
        while (used.has(name.toLowerCase())) name = item.outName.replace(/(\.\w+)$/, ` (${n++})$1`);
        used.add(name.toLowerCase());
        zip.file(name, item.blob);
      }
      const blob = await zip.generateAsync({ type: "blob" }); // photos are already compressed
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `converted-${EXT[format()]}.zip`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } finally {
      zipBtn.textContent = label;
      refresh();
    }
  });
})();
