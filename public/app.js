// FreeTool-CF 极简版前端：仅图片压缩，纯浏览器端，不调用任何后端接口
const $ = (id) => document.getElementById(id);

const dropzone = $("dropzone");
const fileInput = $("fileInput");
const options = $("options");
const result = $("result");
const status = $("status");

let currentFile = null;

// 选择 / 拖拽
dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => fileInput.files[0] && loadFile(fileInput.files[0]));
["dragover", "dragenter"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("drag"); })
);
["dragleave", "drop"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("drag"); })
);
dropzone.addEventListener("drop", (e) => {
  const f = e.dataTransfer.files[0];
  if (f) loadFile(f);
});

$("quality").addEventListener("input", (e) => { $("qualityVal").textContent = e.target.value; });

function loadFile(file) {
  if (!/^image\//.test(file.type)) { status.textContent = "请选择图片文件"; return; }
  if (file.size > 20 * 1024 * 1024) { status.textContent = "图片超过 20MB 上限"; return; }
  currentFile = file;
  status.textContent = "";
  result.hidden = true;
  options.hidden = false;
}

$("compressBtn").addEventListener("click", async () => {
  if (!currentFile) return;
  const btn = $("compressBtn");
  btn.disabled = true;
  status.textContent = "压缩中…";
  try {
    const fmt = $("format").value === "keep" ? (currentFile.type || "image/jpeg") : $("format").value;
    const quality = parseInt($("quality").value, 10) / 100;
    const maxw = parseInt($("maxWidth").value, 10) || 0;
    const blob = await compress(currentFile, fmt, quality, maxw);
    const origKb = currentFile.size / 1024;
    const newKb = blob.size / 1024;
    const saved = Math.max(0, 100 - (blob.size / currentFile.size) * 100);
    $("origSize").textContent = origKb.toFixed(1) + " KB";
    $("newSize").textContent = newKb.toFixed(1) + " KB";
    $("saved").textContent = `节省 ${saved.toFixed(0)}%`;
    const url = URL.createObjectURL(blob);
    const dl = $("downloadLink");
    dl.href = url;
    dl.download = "compressed." + extOf(fmt);
    result.hidden = false;
    status.textContent = "";
  } catch (e) {
    status.textContent = "压缩失败：" + e.message;
  } finally {
    btn.disabled = false;
  }
});

$("resetBtn").addEventListener("click", () => {
  currentFile = null;
  fileInput.value = "";
  options.hidden = true;
  result.hidden = true;
  status.textContent = "";
});

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
      const q = fmt === "image/png" ? undefined : quality;
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error("导出失败")), fmt, q);
    };
    img.onerror = () => reject(new Error("无法读取图片"));
    img.src = url;
  });
}

function extOf(fmt) {
  return { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" }[fmt] || "img";
}
