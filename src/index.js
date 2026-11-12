/**
 * FreeTool-CF —— 纯 Cloudflare 栈的免费图片工具 Worker
 * 功能：AI 去背景、AI 放大 (2x)、图片压缩（压缩在浏览器端完成）
 *
 * 依赖：
 *  - Cloudflare Images binding（在 wrangler.jsonc 中配置 binding: "IMAGES"）
 *  - Workers Assets（托管 public/ 下的前端静态文件）
 */

const MAX_BYTES = 20 * 1024 * 1024; // Images binding 单张上限 20MB

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ---- API 路由 ----
    if (request.method === "POST" && url.pathname === "/api/remove-bg") {
      return handleRemoveBg(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/upscale") {
      return handleUpscale(request, env);
    }

    // ---- 其余请求交给 Workers Assets 托管的前端 ----
    return env.ASSETS.fetch(request);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function validateImage(file) {
  const type = file?.type || "";
  if (!/^image\/(png|jpe?g|webp|gif|avif|bmp|tiff?|heic|heif)$/i.test(type)) {
    return "仅支持图片文件（PNG / JPEG / WebP / GIF / AVIF 等）";
  }
  return null;
}

/** AI 去背景：segment=foreground（BiRefNet，跑在 Workers AI） */
async function handleRemoveBg(request, env) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "请求格式错误，请使用 multipart/form-data" }, 400);
  }
  const file = form.get("image");
  const err = validateImage(file);
  if (err) return json({ error: err }, 400);

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return json({ error: "图片过大，Cloudflare Images 上限为 20MB" }, 413);
  }

  try {
    const result = await env.IMAGES.input(bytes)
      .transform({ segment: "foreground" })
      .output({ format: "image/png" })
      .response();
    return result; // 直接返回处理后的 PNG 字节流
  } catch (e) {
    return json({ error: "去背景处理失败：" + (e?.message || e) }, 500);
  }
}

/** AI 放大 2x：upscale=generate（ESRGAN），fit=scale-up 不缩只放 */
async function handleUpscale(request, env) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "请求格式错误，请使用 multipart/form-data" }, 400);
  }
  const file = form.get("image");
  const w = parseInt(form.get("w"), 10);
  const h = parseInt(form.get("h"), 10);
  const err = validateImage(file);
  if (err) return json({ error: err }, 400);
  if (!w || !h || w < 1 || h < 1) {
    return json({ error: "缺少原始图片尺寸（w/h）" }, 400);
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return json({ error: "图片过大，Cloudflare Images 上限为 20MB" }, 413);
  }

  try {
    const result = await env.IMAGES.input(bytes)
      .transform({
        upscale: "generate",
        fit: "scale-up",
        width: w * 2,
        height: h * 2,
      })
      .output({ format: "image/png" })
      .response();
    return result;
  } catch (e) {
    return json({ error: "放大处理失败：" + (e?.message || e) }, 500);
  }
}
