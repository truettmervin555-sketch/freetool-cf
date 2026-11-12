// FreeTool-CF 前端逻辑（原生 JS，无需构建）
const $ = (sel, root = document) => root.querySelector(sel);

function setupDropzone(zone, onFile) {
  const input = $("input", zone);
  zone.addEventListener("click", () => input.click());
  input.addEventListener("change", () => input.files[0] && onFile(input.files[0]));
  ["dragover", "dragenter"].forEach((ev) =>
    zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("drag"); })
  );
  ["dragleave", "drop"].forEach((ev) =>
    zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("drag"); })
  );
  zone.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  });
}

function showResult(card, blob, filename) {
  const result = $(".result", card);
  const img = $("img", result);
  const link = $("a.btn", result);
  const url = URL.createObjectURL(blob);
  img.src = url;
  link.href = url;
  link.download = filename;
  result.hidden = false;
  $(".opts", card)?.setAttribute("hidden", "");
}

function setLoading(card, loading) {
  const btn = $(".btn.run", card);
  if (btn) btn.disabled = loading;
}

async function postImage(path, file, extra = {}) {
  const fd = new FormData();
  fd.append("image", file);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  const res = await fetch(path, { method: "POST", body: fd });
  if (!res.ok) {
    let msg = "处理失败";
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.blob();
}

// ---------- 去背景 ----------
document.querySelectorAll('.dropzone[data-tool="bg"]').forEach((zone) => {
  const card = zone.closest(".card");
  setupDropzone(zone, async (file) => {
    try {
      const blob = await postImage("/api/remove-bg", file);
      showResult(card, blob, "removed-bg.png");
    } catch (e) { alert(e.message); }
  });
});

// ---------- 放大 ----------
document.querySelectorAll('.dropzone[data-tool="up"]').forEach((zone) => {
  const card = zone.closest(".card");
  setupDropzone(zone, async (file) => {
    try {
      const dims = await readDims(file); // 先拿原始尺寸
      const blob = await postImage("/api/upscale", file, { w: dims.w, h: dims.h });
      showResult(card, blob, "upscaled.png");
    } catch (e) { alert(e.message); }
  });
});

// ---------- 压缩（纯浏览器） ----------
document.querySelectorAll('.dropzone[data-tool="cp"]').forEach((zone) => {
  const card = zone.closest(".card");
  const opts = $(".opts", card);
  let currentFile = null;

  setupDropzone(zone, (file) => {
    currentFile = file;
    opts.hidden = false;
  });

  $(".run", opts).addEventListener("click", async () => {
    if (!currentFile) return;
    setLoading(card, true);
    try {
      const fmt = $(".fmt", opts).value;
      const quality = parseInt($(".q", opts).value, 10) / 100;
      const maxw = parseInt($(".maxw", opts).value, 10) || 0;
      const blob = await compress(currentFile, fmt, quality, maxw);
      const orig = currentFile.size;
      showResult(card, blob, "compressed." + extOf(fmt));
      $(".meta", card).textContent =
        `原图 ${(orig / 1024).toFixed(1)} KB → 压缩后 ${(blob.size / 1024).toFixed(1)} KB` +
        `（${fmt.split("/")[1].toUpperCase()}，节省 ${Math.max(0, 100 - (blob.size / orig) * 100).toFixed(0)}%）`;
    } catch (e) { alert(e.message); }
    finally { setLoading(card, false); }
  });
});

// 质量滑块联动显示
document.querySelectorAll(".q").forEach((q) => {
  q.addEventListener("input", () => { $(".q-val", q.closest(".opts")).textContent = q.value; });
});

// ---------- 换一张 ----------
document.querySelectorAll(".reset").forEach((btn) => {
  btn.addEventListener("click", () => {
    const card = btn.closest(".card");
    $(".result", card).hidden = true;
    $(".opts", card)?.setAttribute("hidden", "");
  });
});

// ---------- 工具函数 ----------
function readDims(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error("无法读取图片尺寸")); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

function compress(file, fmt, quality, maxw) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { naturalWidth: w, naturalHeight: h } = img;
      if (maxw && w > maxw) { h = Math.round(h * (maxw / w)); w = maxw; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      // PNG 不支持 quality
      const q = fmt === "image/png" ? undefined : quality;
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error("压缩失败")), fmt, q);
    };
    img.onerror = () => reject(new Error("无法读取图片"));
    img.src = url;
  });
}

function extOf(fmt) {
  return { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" }[fmt] || "img";
}
