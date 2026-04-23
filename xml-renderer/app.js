const projectFolderInput = document.getElementById("projectFolderInput");
const timeRange = document.getElementById("timeRange");
const timeLabel = document.getElementById("timeLabel");
const statusEl = document.getElementById("status");
const stageEl = document.getElementById("stage");
const listEl = document.getElementById("textboxList");
const statsEl = document.getElementById("stats");
const slideListEl = document.getElementById("slideList");
const slideCountEl = document.getElementById("slideCount");
const inspectOutputEl = document.getElementById("inspectOutput");
const copyInspectBtn = document.getElementById("copyInspectBtn");

let projectContext = null;
let objectUrls = [];
const STORYLINE_FONT_SCALE = 1.12;
const STORYLINE_VERTICAL_OFFSET_PX = 0;
const STORYLINE_VERTICAL_INSET_TOP_FACTOR = 1.2;
const STORYLINE_VERTICAL_INSET_BOTTOM_FACTOR = 1.0;
const STORYLINE_TITLE_LINE_HEIGHT = 1.06;
const STORYLINE_TITLE_VERTICAL_NUDGE_PX = 1;
const STORYLINE_DYNAMIC_TOP_PADDING_RATIO = 0.12;
const STORYLINE_DYNAMIC_TOP_PADDING_MAX_PX = 8;
const SHOW_INACTIVE_AS_GHOST = true;
const HIDE_INACTIVE_IMAGES = true;

let state = {
  shapes: [],
  durationMs: 0,
  currentTimeMs: 0,
  currentSlidePath: "",
};
let hoveredShapeKey = null;
let selectedShapeKey = null;

copyInspectBtn.addEventListener("click", async () => {
  const text = inspectOutputEl.textContent || "";
  if (!text.trim()) return;
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Details copies dans le presse-papiers.");
  } catch {
    setStatus("Impossible de copier automatiquement. Selectionne et copie manuellement.");
  }
});

projectFolderInput.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) {
    projectContext = null;
    setStatus("Dossier projet retire. Le mode assets reel est desactive.");
    return;
  }

  projectContext = await buildProjectContext(files);
  const mediaCount = projectContext.assetByGuid.size;
  const relInfo = projectContext.relsMediaSummary;
  renderSlideList(projectContext.slideFiles);
  setStatus(
    `Dossier charge: ${files.length} fichiers | slides: ${projectContext.slideFiles.length} | assets: ${mediaCount} | media rels: ${relInfo.found}/${relInfo.total} presentes`
  );

  if (projectContext.slideFiles.length) {
    await renderSlideByPath(projectContext.slideFiles[0].path);
  }
});

async function renderSlideByPath(slidePath) {
  if (!projectContext) return;
  const slideFile = projectContext.filesByRelativePath.get(slidePath.toLowerCase());
  if (!slideFile) {
    setStatus(`Slide introuvable: ${slidePath}`);
    return;
  }
  try {
    const xmlText = await slideFile.text();
    const slideRels = await buildSlideRelsIndex(basename(slidePath), projectContext);
    const parsed = parseSlideXml(xmlText, projectContext, slideRels);

    state.shapes = parsed.shapes;
    state.durationMs = parsed.durationMs;
    state.currentTimeMs = 0;
    state.currentSlidePath = slidePath;

    timeRange.disabled = false;
    timeRange.min = "0";
    timeRange.max = String(Math.max(1000, state.durationMs));
    timeRange.value = "0";
    timeLabel.textContent = "0 ms";

    renderAll();
    markActiveSlideButton(slidePath);
    setStatus(
      `Slide chargee: ${basename(slidePath)} | elements: ${state.shapes.length} | images resolues: ${parsed.resolvedImages} | audios resolus: ${parsed.resolvedAudios} | duree: ${state.durationMs} ms`
    );
  } catch (error) {
    console.error(error);
    setStatus(`Erreur de parsing XML: ${error.message}`);
    resetView();
  }
}

timeRange.addEventListener("input", (event) => {
  state.currentTimeMs = Number(event.target.value || 0);
  timeLabel.textContent = `${state.currentTimeMs} ms`;
  renderActiveState();
});

function setStatus(message) {
  statusEl.textContent = message;
}

function resetView() {
  revokeObjectUrls();
  state = { shapes: [], durationMs: 0, currentTimeMs: 0, currentSlidePath: "" };
  stageEl.innerHTML = "";
  listEl.innerHTML = "";
  statsEl.textContent = "";
  timeRange.disabled = true;
  timeRange.value = "0";
  timeLabel.textContent = "0 ms";
  hoveredShapeKey = null;
  selectedShapeKey = null;
  inspectOutputEl.textContent = "Clique sur un element pour voir ses details.";
}

function renderSlideList(slides) {
  slideListEl.innerHTML = "";
  slideCountEl.textContent = String(slides.length);
  slides.forEach((slide) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = slide.label;
    btn.dataset.path = slide.path;
    btn.addEventListener("click", () => renderSlideByPath(slide.path));
    li.appendChild(btn);
    slideListEl.appendChild(li);
  });
}

function markActiveSlideButton(path) {
  slideListEl.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.path === path);
  });
}

function parseSlideXml(xmlText, ctx, slideRels) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "application/xml");
  const parserError = xmlDoc.querySelector("parsererror");
  if (parserError) {
    throw new Error("XML invalide.");
  }

  const root = xmlDoc.documentElement;
  const shapeList = getDirectChildByTagName(root, "shapeLst");
  if (!shapeList) {
    throw new Error("Aucun <shapeLst> trouve.");
  }

  const durationMs = getSlideDuration(root);
  const shapes = [];
  let resolvedImages = 0;
  let resolvedAudios = 0;
  const shapeNodes = Array.from(shapeList.children);
  const relFallbackCursor = { image: 0, audio: 0, video: 0, asset: 0 };

  shapeNodes.forEach((node, index) => {
    const tagName = node.tagName;
    const id = node.getAttribute("id") || `tb-${index + 1}`;
    const shapeKey = `${tagName}-${index + 1}-${id}`;
    const shapeState = node.getAttribute("state") || "";
    const zOrder = Number(node.getAttribute("zOrder") || index);
    const plainText = (node.querySelector(":scope > plain")?.textContent || "").trim();
    const richData = extractRichTextData(node);
    const name = node.getAttribute("name") || "";
    const typeName = node.getAttribute("typeName") || "";
    let text = plainText || richData.text || "";
    const alt = (node.querySelector(":scope > alt")?.textContent || "").trim();
    const timing = readTiming(node);
    const rect = readShapeRect(node);
    const transform = readShapeTransform(node);
    const role = classifyShape(node, tagName);
    if (shouldSkipShape(node, role)) {
      return;
    }
    const triggerCount = node.querySelectorAll(":scope > trigLst > trig").length;

    const assetG = node.getAttribute("assetG") || "";
    const roleKind = roleToMediaKind(role);
    const assetMediaRef = resolveMediaReference(assetG, ctx);
    const relMediaRef = consumeRelFallbackMedia(roleKind, slideRels, relFallbackCursor);
    const mediaRef = pickBestMediaRef(assetMediaRef, relMediaRef, roleKind);
    if (mediaRef?.kind === "image" && mediaRef?.file) resolvedImages += 1;
    if (mediaRef?.kind === "audio" && mediaRef?.file) resolvedAudios += 1;

    const buttonNormalNode = role === "button" ? getButtonNormalStateNode(node) : null;
    let textStyleNode = node;
    let textStyleRich = richData.style;
    if (buttonNormalNode) {
      const normalPlain = (buttonNormalNode.querySelector(":scope > plain")?.textContent || "").trim();
      const normalRich = extractRichTextData(buttonNormalNode);
      const normalText = normalPlain || normalRich.text || "";
      if (normalText) {
        text = normalText;
      }
      textStyleNode = buttonNormalNode;
      textStyleRich = normalRich.style;
    }
    if (role === "button") {
      text = normalizeButtonLabel(text);
    }

    shapes.push({
      key: shapeKey,
      id,
      state: shapeState,
      tagName,
      role,
      name,
      typeName,
      zOrder,
      text,
      textStyle: deriveTextStyle(textStyleNode, textStyleRich),
      alt,
      triggerCount,
      assetG,
      mediaRef,
      startMs: timing.startMs,
      durMs: timing.durMs,
      endMs: timing.startMs + timing.durMs,
      rect,
      transform,
      boxStyle: role === "button" ? extractButtonBaseStyle(node, rect) : null,
    });
  });

  shapes.sort((a, b) => a.zOrder - b.zOrder);
  return { shapes, durationMs, resolvedImages, resolvedAudios };
}

function getSlideDuration(root) {
  const candidates = [
    getDirectChildByTagName(root, "tmProps")?.getAttribute("min"),
    getDirectChildByTagName(getDirectChildByTagName(root, "panTime"), "tmProps")?.getAttribute("min"),
  ];

  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return 1000;
}

function getDirectChildByTagName(parent, tagName) {
  if (!parent) return null;
  const children = parent.children ? Array.from(parent.children) : [];
  return children.find((child) => child.tagName === tagName) || null;
}

function readTiming(textboxNode) {
  const tmCtx =
    textboxNode.querySelector("tmCtxLst > txtTmCtx") ||
    textboxNode.querySelector("tmCtxLst > *");
  const tmProps = textboxNode.querySelector(":scope > tmProps");
  const startMs = Number(tmCtx?.getAttribute("start") || 0);
  const durMsRaw = Number(tmCtx?.getAttribute("dur") || 0);
  const durMs = Math.max(0, durMsRaw);
  const tmCtxVisible = (tmCtx?.getAttribute("visible") || "").trim().toLowerCase();
  const tmPropsVisible = (tmProps?.getAttribute("visible") || "").trim().toLowerCase();
  const tmPropsHideAll = (tmProps?.getAttribute("hideAll") || "").trim().toLowerCase();
  const isVisible =
    tmCtxVisible !== "false" && tmPropsVisible !== "false" && tmPropsHideAll !== "true";
  return { startMs, durMs, isVisible };
}

function readShapeRect(node) {
  const locNode = node.querySelector(":scope > loc");
  if (locNode) {
    const l = Number(locNode.getAttribute("l"));
    const t = Number(locNode.getAttribute("t"));
    const r = Number(locNode.getAttribute("r"));
    const b = Number(locNode.getAttribute("b"));
    if ([l, t, r, b].every(Number.isFinite)) {
      return {
        left: l,
        top: t,
        width: Math.max(12, r - l),
        height: Math.max(12, b - t),
      };
    }
  }

  const boundsNode = node.querySelector(":scope > bounds");
  if (boundsNode) {
    const l = Number(boundsNode.getAttribute("l"));
    const t = Number(boundsNode.getAttribute("t"));
    const r = Number(boundsNode.getAttribute("r"));
    const b = Number(boundsNode.getAttribute("b"));
    if ([l, t, r, b].every(Number.isFinite)) {
      return {
        left: l,
        top: t,
        width: Math.max(12, r - l),
        height: Math.max(12, b - t),
      };
    }
  }

  return { left: 20, top: 20, width: 180, height: 60 };
}

function readShapeTransform(node) {
  const rawRot = Number(node.getAttribute("rot"));
  const hasRotation = Number.isFinite(rawRot) && rawRot >= 0 && Math.abs(rawRot) > 0.001;
  const flipH = (node.getAttribute("flipH") || "").toLowerCase() === "true";
  const flipV = (node.getAttribute("flipV") || "").toLowerCase() === "true";
  if (!hasRotation && !flipH && !flipV) return "";

  const parts = [];
  if (hasRotation) parts.push(`rotate(${rawRot}deg)`);
  if (flipH || flipV) {
    const sx = flipH ? -1 : 1;
    const sy = flipV ? -1 : 1;
    parts.push(`scale(${sx}, ${sy})`);
  }
  return parts.join(" ");
}

function classifyShape(node, tagName) {
  if (tagName === "pic" || tagName === "svgimage") return "image";
  if (tagName === "sound" || tagName === "audio") return "audio";
  if (tagName === "video") return "video";
  if (tagName === "textBox") return "text";
  if (tagName === "hotspot") return "hotspot";

  if (tagName === "roundRect" || tagName === "rect") {
    const hasClickTrigger = Array.from(node.querySelectorAll(":scope > trigLst > trig")).some((trig) => {
      const ev = trig.querySelector(":scope > data")?.getAttribute("event");
      return ev === "OnClick";
    });
    if (hasClickTrigger) return "button";
    return "shape";
  }

  return "shape";
}

function shouldSkipShape(node, role) {
  if (role !== "image") return false;
  const tmProps = node.querySelector(":scope > tmProps");
  const tmCtx =
    node.querySelector("tmCtxLst > txtTmCtx") ||
    node.querySelector("tmCtxLst > *");
  const tmCtxVisible = (tmCtx?.getAttribute("visible") || "").trim().toLowerCase();
  const tmPropsVisible = (tmProps?.getAttribute("visible") || "").trim().toLowerCase();
  const tmPropsHideAll = (tmProps?.getAttribute("hideAll") || "").trim().toLowerCase();
  if (tmCtxVisible === "false") return true;
  if (tmPropsVisible === "false") return true;
  if (tmPropsHideAll === "true") return true;
  return false;
}

function pickFirstFinite(source, keys, fallback) {
  for (const key of keys) {
    if (Number.isFinite(source[key])) {
      return source[key];
    }
  }
  return fallback;
}

function extractEmbeddedText(raw) {
  if (!raw || !raw.trim()) {
    return "";
  }

  try {
    const embedded = new DOMParser().parseFromString(raw, "application/xml");
    const parserError = embedded.querySelector("parsererror");
    if (parserError) {
      return "";
    }

    const text = extractEmbeddedBlocksText(embedded);
    if (!text) {
      return "";
    }
    return text;
  } catch {
    return "";
  }
}

function extractRichTextData(node) {
  const fmtData = parseEmbeddedRich(node.querySelector(":scope > fmtText")?.textContent || "");
  const textData = parseEmbeddedRich(node.querySelector(":scope > text")?.textContent || "");

  // Empirically on Storyline slides, `text` better matches final visual placement
  // (alignment/size), while `fmtText` often carries useful fallback typography.
  const mergedStyle = {
    ...fmtData.style,
    ...textData.style,
  };
  preferKeysFromText(mergedStyle, textData.style, [
    "Justification",
    "FontSize",
    "FontFamily",
    "LineSpacing",
    "LineSpacingRule",
  ]);

  return {
    text: textData.text || fmtData.text || "",
    style: mergedStyle,
  };
}

function preferKeysFromText(target, fromText, keys) {
  keys.forEach((key) => {
    if (fromText[key] !== undefined && fromText[key] !== "") {
      target[key] = fromText[key];
    }
  });
}

function normalizeButtonLabel(text) {
  return (text || "")
    .replace(/\r/g, "\n")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function parseEmbeddedRich(raw) {
  if (!raw || !raw.trim()) return { text: "", style: {} };
  try {
    const embedded = new DOMParser().parseFromString(raw, "application/xml");
    if (embedded.querySelector("parsererror")) return { text: "", style: {} };

    const spans = Array.from(embedded.querySelectorAll("Block > Span"));
    if (!spans.length) return { text: "", style: {} };
    const text = extractEmbeddedBlocksText(embedded);

    const styleNode = spans[0].querySelector("Style");
    const blockStyle = embedded.querySelector("Block > Style");
    return {
      text,
      style: {
        ...attrsToObject(blockStyle?.attributes),
        ...attrsToObject(styleNode?.attributes),
      },
    };
  } catch {
    return { text: "", style: {} };
  }
}

function extractEmbeddedBlocksText(embeddedDoc) {
  const blocks = Array.from(embeddedDoc.querySelectorAll("Block"));
  if (!blocks.length) return "";

  const lines = blocks
    .map((block) => {
      const spans = Array.from(block.querySelectorAll(":scope > Span"));
      if (!spans.length) return "";
      return spans
        .map((span) => (span.getAttribute("Text") || "").replace(/\r/g, "\n"))
        .join("");
    })
    .filter((line) => line !== "");

  return lines.join("\n").trim();
}

function attrsToObject(namedNodeMap) {
  if (!namedNodeMap) return {};
  return Array.from(namedNodeMap).reduce((acc, attr) => {
    acc[attr.name] = attr.value;
    return acc;
  }, {});
}

function deriveTextStyle(node, richStyle) {
  const fontFamilyRaw = richStyle.FontFamily || "";
  const fontSizeRaw = richStyle.FontSize || "";
  const justifRaw = (richStyle.Justification || "").toLowerCase();
  const colorRaw = richStyle.ForegroundColor || "";
  const nodeHAlign = (node.getAttribute("horzAlign") || "").toLowerCase();
  const nodeVAlign = (node.getAttribute("vertAlign") || "").toLowerCase();
  const textMargin = readTextMargin(node);
  const boundsInset = readBoundsInset(node);
  const effectiveInset = {
    l: Math.max(textMargin.l, boundsInset.l),
    t: applyVerticalInsetCalibration(Math.max(textMargin.t, boundsInset.t), "top"),
    r: Math.max(textMargin.r, boundsInset.r),
    b: applyVerticalInsetCalibration(Math.max(textMargin.b, boundsInset.b), "bottom"),
  };
  const lineHeight = deriveLineHeight(richStyle, Number(fontSizeRaw) || null);
  const letterSpacing = deriveLetterSpacing(richStyle);
  const paragraphSpacing = deriveParagraphSpacing(richStyle);
  const textIndent = deriveTextIndent(richStyle);
  const titleMetrics = deriveTitleMetrics(richStyle, Number(fontSizeRaw) || null);
  const dynamicTopPadding = deriveDynamicTopPadding(Number(fontSizeRaw) || null);
  const weightHint = inferWeightFromFontFamily(fontFamilyRaw);
  const explicitBold = (richStyle.FontIsBold || "").toLowerCase() === "true";
  const explicitItalic = (richStyle.FontIsItalic || "").toLowerCase() === "true";

  return {
    fontFamily: mapFontFamily(cleanFontFamily(fontFamilyRaw)),
    fontSize: scaleStorylineFontSize(Number(fontSizeRaw) || null),
    fontWeight: explicitBold ? Math.max(700, weightHint) : weightHint,
    fontStyle: explicitItalic ? "italic" : "normal",
    textAlign: mapHAlign(justifRaw || nodeHAlign),
    justifyContent: mapVAlign(nodeVAlign),
    color: mapStorylineColor(colorRaw),
    lineHeight,
    letterSpacing,
    paragraphSpacing,
    textIndent,
    dynamicTopPadding,
    titleLineHeight: titleMetrics.lineHeight,
    textNudgeY: titleMetrics.nudgeY,
    textMargin: effectiveInset,
  };
}

function scaleStorylineFontSize(px) {
  if (!px || !Number.isFinite(px)) return null;
  return Number((px * STORYLINE_FONT_SCALE).toFixed(2));
}

function readTextMargin(node) {
  const marginNode = node.querySelector(":scope > textMargin");
  if (!marginNode) return { l: 0, t: 0, r: 0, b: 0 };
  const get = (key) => {
    const n = Number(marginNode.getAttribute(key));
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  };
  return {
    l: get("l"),
    t: get("t"),
    r: get("r"),
    b: get("b"),
  };
}

function readBoundsInset(node) {
  const locNode = node.querySelector(":scope > loc");
  const boundsNode = node.querySelector(":scope > bounds");
  if (!locNode || !boundsNode) return { l: 0, t: 0, r: 0, b: 0 };

  const loc = {
    l: Number(locNode.getAttribute("l")),
    t: Number(locNode.getAttribute("t")),
    r: Number(locNode.getAttribute("r")),
    b: Number(locNode.getAttribute("b")),
  };
  const bounds = {
    l: Number(boundsNode.getAttribute("l")),
    t: Number(boundsNode.getAttribute("t")),
    r: Number(boundsNode.getAttribute("r")),
    b: Number(boundsNode.getAttribute("b")),
  };
  if (![loc.l, loc.t, loc.r, loc.b, bounds.l, bounds.t, bounds.r, bounds.b].every(Number.isFinite)) {
    return { l: 0, t: 0, r: 0, b: 0 };
  }

  const locW = loc.r - loc.l;
  const locH = loc.b - loc.t;
  if (locW <= 0 || locH <= 0) return { l: 0, t: 0, r: 0, b: 0 };

  return {
    l: clampNonNegative(bounds.l),
    t: clampNonNegative(bounds.t),
    r: clampNonNegative(locW - bounds.r),
    b: clampNonNegative(locH - bounds.b),
  };
}

function clampNonNegative(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, v);
}

function applyVerticalInsetCalibration(v, edge) {
  const factor =
    edge === "top" ? STORYLINE_VERTICAL_INSET_TOP_FACTOR : STORYLINE_VERTICAL_INSET_BOTTOM_FACTOR;
  return Math.max(0, Number((v * factor).toFixed(2)));
}

function deriveLineHeight(richStyle, fontSizePx) {
  const raw = Number(richStyle.LineSpacing || "");
  if (!Number.isFinite(raw) || raw <= 0) return "";
  const rule = (richStyle.LineSpacingRule || "").toLowerCase();

  // Storyline often stores "Multiple" with a base-20 scale (20 ~= single line).
  if (rule.includes("exact")) return `${raw}px`;
  if (rule.includes("multiple")) {
    const ratio = raw / 20;
    const normalized = Math.max(0.8, Math.min(3, ratio));
    return String(Number(normalized.toFixed(3)));
  }
  return "";
}

function deriveLetterSpacing(richStyle) {
  const raw = Number(richStyle.Spacing || "");
  if (!Number.isFinite(raw) || Math.abs(raw) < 0.001) return "";
  return `${raw}px`;
}

function deriveParagraphSpacing(richStyle) {
  const before = Number(richStyle.SpacingBefore || "");
  const after = Number(richStyle.SpacingAfter || "");
  return {
    before: Number.isFinite(before) && before !== 0 ? `${before}px` : "",
    after: Number.isFinite(after) && after !== 0 ? `${after}px` : "",
  };
}

function deriveTextIndent(richStyle) {
  const firstLine = Number(richStyle.FirstLineMargin || "");
  if (!Number.isFinite(firstLine) || Math.abs(firstLine) < 0.001) return "";
  return `${firstLine}px`;
}

function deriveTitleMetrics(richStyle, fontSizePx) {
  const family = (richStyle.FontFamily || "").toLowerCase();
  const size = Number(fontSizePx) || 0;
  const isLikelyTitleFamily =
    family.includes("poppins") || family.includes("baloo") || family.includes("inter");
  const isLargeText = size >= 26;
  if (!isLikelyTitleFamily || !isLargeText) {
    return { lineHeight: "", nudgeY: 0 };
  }
  return {
    lineHeight: String(STORYLINE_TITLE_LINE_HEIGHT),
    nudgeY: STORYLINE_TITLE_VERTICAL_NUDGE_PX,
  };
}

function deriveDynamicTopPadding(fontSizePx) {
  if (!fontSizePx || !Number.isFinite(fontSizePx)) return "";
  const px = Math.min(
    STORYLINE_DYNAMIC_TOP_PADDING_MAX_PX,
    Math.max(0, fontSizePx * STORYLINE_DYNAMIC_TOP_PADDING_RATIO)
  );
  if (px < 0.5) return "";
  return `${Number(px.toFixed(2))}px`;
}

function cleanFontFamily(raw) {
  if (!raw) return "";
  return raw.replace(/\s+(Bold|SemiBold|ExtraBold|Light|Regular)$/i, "").trim();
}

function inferWeightFromFontFamily(raw) {
  const v = (raw || "").toLowerCase();
  if (v.includes("extrabold") || v.includes("extra bold")) return 800;
  if (v.includes("semibold") || v.includes("semi bold")) return 600;
  if (v.includes("bold")) return 700;
  if (v.includes("medium")) return 500;
  if (v.includes("light")) return 300;
  return 400;
}

function mapFontFamily(fontFamily) {
  const v = (fontFamily || "").toLowerCase();
  if (!v) return "";
  if (v.includes("poppins")) return "Poppins";
  if (v.includes("baloo")) return "Baloo 2";
  if (v.includes("inter")) return "Inter";
  return fontFamily;
}

function mapHAlign(value) {
  if (value.startsWith("c")) return "center";
  if (value.startsWith("r")) return "right";
  return "left";
}

function mapVAlign(value) {
  if (value === "m") return "center";
  if (value === "b") return "flex-end";
  return "flex-start";
}

function mapStorylineColor(value) {
  if (!value) return "";
  if (value.startsWith("#")) {
    const hex = value.split(",")[0];
    return /^#[0-9a-fA-F]{6,8}$/.test(hex) ? hex.slice(0, 7) : "";
  }
  return "";
}

function renderAll() {
  revokeObjectUrls();
  stageEl.innerHTML = "";
  listEl.innerHTML = "";

  let maxRight = 0;
  let maxBottom = 0;

  const typeCount = {};

  state.shapes.forEach((shape) => {
    typeCount[shape.role] = (typeCount[shape.role] || 0) + 1;

    const box = document.createElement("div");
    box.className = `shape shape-${shape.role}`;
    box.dataset.id = shape.key;
    box.style.left = `${shape.rect.left}px`;
    box.style.top = `${shape.rect.top}px`;
    box.style.width = `${shape.rect.width}px`;
    box.style.height = `${shape.rect.height}px`;
    box.style.zIndex = String(shape.zOrder);
    box.style.display = shape.state === "107367" || shape.state === "107303" ? "none" : "";
    box.style.transformOrigin = "center center";
    box.style.transform = shape.transform || "";
    applyBoxStyle(box, shape.boxStyle);
    box.innerHTML = getShapeInnerHtml(shape);
    box.addEventListener("click", () => selectShape(shape.key));
    stageEl.appendChild(box);

    maxRight = Math.max(maxRight, shape.rect.left + shape.rect.width);
    maxBottom = Math.max(maxBottom, shape.rect.top + shape.rect.height);

    const li = document.createElement("li");
    li.dataset.id = shape.key;
    li.addEventListener("mouseenter", () => setHoveredShape(shape.key));
    li.addEventListener("mouseleave", () => clearHoveredShape(shape.key));
    li.addEventListener("click", () => selectShape(shape.key));
    li.innerHTML = `
      <div><strong>${escapeHtml(shape.id)}</strong> | ${escapeHtml(shape.tagName)} (${escapeHtml(shape.role)})</div>
      <div>${escapeHtml(shape.text || shape.name || shape.typeName || "(sans texte)")}</div>
      <div class="meta">${shape.startMs} ms -> ${shape.endMs} ms (dur: ${shape.durMs} ms)</div>
      <div class="meta">z:${shape.zOrder} | triggers:${shape.triggerCount}${shape.assetG ? ` | asset:${escapeHtml(shape.assetG.slice(0, 8))}...` : ""}</div>
      <div class="meta">${shape.mediaRef?.note ? escapeHtml(shape.mediaRef.note) : "asset non resolu"}</div>
    `;
    listEl.appendChild(li);
  });

  stageEl.style.minWidth = `${Math.max(900, maxRight + 40)}px`;
  stageEl.style.minHeight = `${Math.max(500, maxBottom + 40)}px`;

  const summary = Object.entries(typeCount)
    .map(([k, v]) => `${k}:${v}`)
    .join(" | ");
  statsEl.textContent = `elements: ${state.shapes.length} | ${summary} | duree slide: ${state.durationMs} ms`;
  renderActiveState();
}

function renderActiveState() {
  const current = state.currentTimeMs;

  state.shapes.forEach((shape) => {
    const isActive = current >= shape.startMs && current <= shape.endMs;

    const box = stageEl.querySelector(`.shape[data-id="${cssEscape(shape.key)}"]`);
    if (box) {
      box.classList.toggle("active", isActive);
      box.classList.toggle("inactive", !isActive);
      box.classList.toggle("hovered-from-list", hoveredShapeKey === shape.key);
      if (SHOW_INACTIVE_AS_GHOST) {
        box.style.visibility = "visible";
      } else if (HIDE_INACTIVE_IMAGES && shape.role === "image" && !isActive) {
        box.style.visibility = "hidden";
      } else {
        box.style.visibility = isActive ? "visible" : "hidden";
      }
      if (hoveredShapeKey === shape.key) {
        box.style.visibility = "visible";
      }
      box.style.outlineOffset = selectedShapeKey === shape.key ? "2px" : "0";
      if (selectedShapeKey === shape.key) {
        box.style.outlineColor = "#74c0ff";
      }
    }

    const listItem = listEl.querySelector(`li[data-id="${cssEscape(shape.key)}"]`);
    if (listItem) {
      listItem.classList.toggle("current", isActive);
      listItem.classList.toggle("hovered", hoveredShapeKey === shape.key);
      listItem.classList.toggle("selected", selectedShapeKey === shape.key);
    }
  });
}

function setHoveredShape(key) {
  hoveredShapeKey = key;
  renderActiveState();
}

function clearHoveredShape(key) {
  if (hoveredShapeKey !== key) return;
  hoveredShapeKey = null;
  renderActiveState();
}

function selectShape(key) {
  selectedShapeKey = key;
  renderActiveState();
  const shape = state.shapes.find((s) => s.key === key);
  if (!shape) return;
  inspectOutputEl.textContent = formatShapeDebug(shape);
}

function formatShapeDebug(shape) {
  const lines = [
    `slide_xml: ${state.currentSlidePath || "(inconnu)"}`,
    `object_id: ${shape.id}`,
    `tag: ${shape.tagName}`,
    `role: ${shape.role}`,
    `name: ${shape.name || "-"}`,
    `typeName: ${shape.typeName || "-"}`,
    `zOrder: ${shape.zOrder}`,
    `text: ${shape.text || "-"}`,
    `alt: ${shape.alt || "-"}`,
    `assetG: ${shape.assetG || "-"}`,
    `timing: start=${shape.startMs} dur=${shape.durMs} end=${shape.endMs}`,
    `rect: left=${shape.rect.left} top=${shape.rect.top} width=${shape.rect.width} height=${shape.rect.height}`,
    `triggerCount: ${shape.triggerCount}`,
    `media: ${shape.mediaRef?.displayName || shape.mediaRef?.source || shape.mediaRef?.note || "-"}`,
    `media_kind: ${shape.mediaRef?.kind || "-"}`,
  ];
  return lines.join("\n");
}

function getShapeInnerHtml(shape) {
  if (shape.role === "text" || shape.role === "button") {
    const textStyles = splitTextStyles(shape.textStyle);
    return `<div class="shape-label text-content" style="${textStyles.container}"><div class="text-lines" style="${textStyles.text}">${escapeHtml(shape.text || shape.name || shape.typeName || "")}</div></div>`;
  }
  if (shape.role === "image") {
    if (shape.mediaRef?.file) {
      const url = registerObjectUrl(shape.mediaRef.file);
      return `<img class="shape-image-content" src="${url}" alt="${escapeHtml(shape.name || shape.typeName || "image")}" />`;
    }
    return `<div class="shape-label">Image</div><div class="shape-meta">${escapeHtml(shape.typeName || shape.name || "")}</div>`;
  }
  if (shape.role === "audio") {
    if (shape.mediaRef?.file) {
      const url = registerObjectUrl(shape.mediaRef.file);
      return `<div class="shape-label">Audio</div><audio class="audio-player" controls preload="metadata" src="${url}"></audio>`;
    }
    return `<div class="shape-label">Audio</div><div class="shape-meta">${escapeHtml(shape.name || "")}</div>`;
  }
  if (shape.role === "video") {
    return `<div class="shape-label">Video</div><div class="shape-meta">${escapeHtml(shape.name || "")}</div>`;
  }
  return `<div class="shape-label">${escapeHtml(shape.tagName)}</div>`;
}

function applyBoxStyle(el, style) {
  if (!style) return;
  if (style.backgroundColor) el.style.backgroundColor = style.backgroundColor;
  if (style.borderColor) el.style.borderColor = style.borderColor;
  if (style.borderWidth !== undefined) el.style.borderWidth = `${style.borderWidth}px`;
  if (style.borderStyle) el.style.borderStyle = style.borderStyle;
  if (style.borderRadius !== undefined) el.style.borderRadius = `${style.borderRadius}px`;
}

function extractButtonBaseStyle(buttonNode, rect) {
  const baseNode = getButtonNormalStateNode(buttonNode) || buttonNode;
  const bgNode = baseNode.querySelector(":scope > bG");
  if (!bgNode) return null;

  const fillColor = readFillColor(bgNode);
  const lineInfo = readLineStyle(bgNode);
  const radius = readButtonRadius(baseNode, rect, buttonNode);

  return {
    backgroundColor: fillColor || "rgba(60,165,92,0.35)",
    borderColor: lineInfo.color || "rgba(88,230,129,0.7)",
    borderWidth: lineInfo.widthPx,
    borderStyle: lineInfo.widthPx > 0 ? "solid" : "solid",
    borderRadius: radius,
  };
}

function getButtonNormalStateNode(buttonNode) {
  const stateNodes = Array.from(buttonNode.querySelectorAll(":scope > stateLst > state"));
  const normalState = stateNodes.find((s) => (s.getAttribute("name") || "").toLowerCase() === "normal");
  if (!normalState) return null;
  const shapeList = normalState.querySelector(":scope > shapeLst");
  if (!shapeList || !shapeList.children.length) return null;
  return shapeList.children[0];
}

function readFillColor(bgNode) {
  const srgb = bgNode.querySelector(":scope > solidFill > clr > srgbClr");
  if (srgb?.getAttribute("val")) return `#${srgb.getAttribute("val")}`;

  const scheme = bgNode.querySelector(":scope > solidFill > clr > schemeClr");
  if (scheme?.getAttribute("val")) return mapSchemeColorToCss(scheme.getAttribute("val"));
  return "";
}

function readLineStyle(bgNode) {
  const hasNoLine = !!bgNode.querySelector(":scope > noLine");
  if (hasNoLine) return { widthPx: 0, color: "transparent" };

  const lineStyle = bgNode.querySelector(":scope > lineStyle");
  const width = Number(lineStyle?.getAttribute("w"));
  const widthPx = Number.isFinite(width) ? Math.max(0, width) : 1;

  const srgb = bgNode.querySelector(":scope > solidLine > clr > srgbClr");
  if (srgb?.getAttribute("val")) {
    return { widthPx, color: `#${srgb.getAttribute("val")}` };
  }
  const scheme = bgNode.querySelector(":scope > solidLine > clr > schemeClr");
  if (scheme?.getAttribute("val")) {
    return { widthPx, color: mapSchemeColorToCss(scheme.getAttribute("val")) };
  }
  return { widthPx, color: "" };
}

function readButtonRadius(node, rect, fallbackNode = null) {
  const radiusNode =
    node.querySelector(":scope > rndC") ||
    fallbackNode?.querySelector(":scope > rndC");
  const rndC = radiusNode;
  if (rndC) {
    const usePc = (rndC.getAttribute("usePc") || "").toLowerCase() === "true";
    const corners = ["rTL", "rTR", "rBL", "rBR"]
      .map((k) => Number(rndC.getAttribute(k)))
      .filter((v) => Number.isFinite(v) && v > 0);
    if (usePc && corners.length) {
      const cornerRatio = Math.max(...corners);
      return Math.max(2, Math.min(rect.width, rect.height) * cornerRatio);
    }

    const defAll = Number(rndC.getAttribute("DefAll"));
    if (usePc && Number.isFinite(defAll)) {
      return Math.max(2, Math.min(rect.width, rect.height) * defAll);
    }
  }
  if (
    node.querySelector(":scope > prstGeom > roundedCorners") ||
    fallbackNode?.querySelector(":scope > prstGeom > roundedCorners")
  ) {
    return Math.max(10, Math.min(rect.width, rect.height) * 0.5);
  }
  return 8;
}

function mapSchemeColorToCss(value) {
  const key = (value || "").toLowerCase();
  if (key === "accent1") return "#2d6e50";
  if (key === "lt1") return "#ffffff";
  if (key === "dk1") return "#111111";
  return "rgba(60,165,92,0.35)";
}

function splitTextStyles(style) {
  if (!style) return { container: "", text: "" };
  const containerParts = [
    style.justifyContent ? `justify-content:${style.justifyContent}` : "",
    style.textMargin ? `padding:${style.textMargin.t}px ${style.textMargin.r}px ${style.textMargin.b}px ${style.textMargin.l}px` : "",
    style.dynamicTopPadding ? `padding-top:calc(${style.textMargin?.t || 0}px + ${style.dynamicTopPadding})` : "",
    STORYLINE_VERTICAL_OFFSET_PX ? `transform:translateY(${STORYLINE_VERTICAL_OFFSET_PX}px)` : "",
  ].filter(Boolean);
  const textParts = [
    style.fontFamily ? `font-family:${cssSafe(style.fontFamily)},sans-serif` : "",
    style.fontSize ? `font-size:${style.fontSize}px` : "",
    style.fontWeight ? `font-weight:${style.fontWeight}` : "",
    style.fontStyle ? `font-style:${style.fontStyle}` : "",
    style.textAlign ? `text-align:${style.textAlign}` : "",
    style.color ? `color:${style.color}` : "",
    style.lineHeight ? `line-height:${style.lineHeight}` : "",
    style.letterSpacing ? `letter-spacing:${style.letterSpacing}` : "",
    style.paragraphSpacing?.before ? `padding-top:${style.paragraphSpacing.before}` : "",
    style.paragraphSpacing?.after ? `padding-bottom:${style.paragraphSpacing.after}` : "",
    style.textIndent ? `text-indent:${style.textIndent}` : "",
    style.textNudgeY ? `transform:translateY(${style.textNudgeY}px)` : "",
    style.textNudgeY ? "display:inline-block" : "",
  ].filter(Boolean);
  if (style.titleLineHeight) {
    const idx = textParts.findIndex((s) => s.startsWith("line-height:"));
    if (idx >= 0) {
      textParts[idx] = `line-height:${style.titleLineHeight}`;
    } else {
      textParts.push(`line-height:${style.titleLineHeight}`);
    }
  }
  return {
    container: containerParts.join(";"),
    text: textParts.join(";"),
  };
}

function cssSafe(value) {
  return String(value).replace(/["';]/g, "");
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return value.replace(/"/g, '\\"');
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function buildProjectContext(files) {
  const filesByRelativePath = new Map();
  const filesByName = new Map();
  files.forEach((file) => {
    const relPath = (file.webkitRelativePath || file.name).replaceAll("\\", "/");
    filesByRelativePath.set(relPath.toLowerCase(), file);
    const lowName = file.name.toLowerCase();
    const list = filesByName.get(lowName) || [];
    list.push(file);
    filesByName.set(lowName, list);
  });

  const storyXmlFile = files.find((file) =>
    (file.webkitRelativePath || "").toLowerCase().endsWith("/story/story.xml")
  );

  const assetByGuid = new Map();
  if (storyXmlFile) {
    const storyXmlText = await storyXmlFile.text();
    parseStoryAssetIndex(storyXmlText).forEach((value, key) => assetByGuid.set(key, value));
  }

  const relsMediaSummary = await computeRelsMediaSummary(files, filesByRelativePath);
  const slideFiles = extractSlideFiles(filesByRelativePath);
  return { filesByRelativePath, filesByName, assetByGuid, relsMediaSummary, slideFiles };
}

function extractSlideFiles(filesByRelativePath) {
  const slides = [];
  for (const relPath of filesByRelativePath.keys()) {
    if (!relPath.includes("/story/slides/")) continue;
    if (relPath.includes("/story/slides/_rels/")) continue;
    if (!relPath.endsWith(".xml")) continue;
    const fileName = basename(relPath);
    if (!/^slide[a-z0-9]*\.xml$/i.test(fileName)) continue;
    slides.push({
      path: relPath,
      label: fileName.replace(".xml", ""),
    });
  }
  slides.sort((a, b) => naturalSlideCompare(a.label, b.label));
  return slides;
}

function naturalSlideCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function parseStoryAssetIndex(storyXmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(storyXmlText, "application/xml");
  const index = new Map();
  const mediaNodes = xmlDoc.querySelectorAll("mediaLst media, mediaLst audio, mediaLst video, mediaLst svgasset");
  mediaNodes.forEach((node) => {
    const guid = node.getAttribute("g");
    if (!guid) return;

    index.set(guid, {
      guid,
      tagName: node.tagName,
      type: node.getAttribute("type") || "",
      displayName: node.getAttribute("displayName") || "",
      source: node.getAttribute("source") || "",
      origFile: node.getAttribute("origFile") || "",
    });
  });
  return index;
}

function resolveMediaReference(assetG, ctx) {
  if (!assetG || !ctx || !ctx.assetByGuid.has(assetG)) return null;
  const meta = ctx.assetByGuid.get(assetG);
  const file = resolveAssetFile(meta, ctx.filesByName);
  const kind = inferAssetKind(meta);
  if (!file) {
    return {
      ...meta,
      kind,
      file: null,
      note: `${kind}: mapping trouvee, fichier binaire absent du dossier`,
    };
  }
  return {
    ...meta,
    kind,
    file,
    note: `${kind}: ${file.name}`,
  };
}

function roleToMediaKind(role) {
  if (role === "image") return "image";
  if (role === "audio") return "audio";
  if (role === "video") return "video";
  return "asset";
}

function consumeRelFallbackMedia(kind, slideRels, cursor) {
  if (!slideRels) return null;
  const list = slideRels[kind] || [];
  const idx = cursor[kind] || 0;
  if (idx >= list.length) return null;
  cursor[kind] = idx + 1;
  const item = list[idx];
  return {
    guid: "",
    tagName: "",
    type: item.type || "",
    displayName: item.file?.name || item.target || "",
    source: item.target || "",
    origFile: item.target || "",
    kind,
    file: item.file || null,
    note: item.file ? `${kind}: ${item.file.name}` : `${kind}: cible .rels non trouvee`,
  };
}

function pickBestMediaRef(primary, fallback, kind = "asset") {
  // For image objects, assetG mapping is often the most stable per-shape key,
  // while .rels can include many assets from states/layers.
  if (kind === "image") {
    if (primary?.file) return primary;
    if (fallback?.file) return fallback;
    return primary || fallback || null;
  }

  // For audio/video, .rels is generally safer for current slide instance.
  if (fallback?.file) return fallback;
  if (primary?.file) return primary;
  return primary || fallback || null;
}

function resolveAssetFile(meta, filesByName) {
  const candidateNames = [meta.displayName, basename(meta.source), basename(meta.origFile)]
    .map((name) => (name || "").trim())
    .filter(Boolean);

  for (const candidate of candidateNames) {
    const matches = filesByName.get(candidate.toLowerCase());
    if (matches?.length) return matches[0];
  }
  return null;
}

function inferAssetKind(meta) {
  const tag = (meta.tagName || "").toLowerCase();
  const type = (meta.type || "").toLowerCase();
  if (tag === "audio" || ["mp3", "wav", "m4a"].includes(type)) return "audio";
  if (tag === "video" || ["mp4", "webm"].includes(type)) return "video";
  if (tag === "svgasset" || ["png", "jpeg", "jpg", "svg", "gif", "webp"].includes(type)) return "image";
  return "asset";
}

function basename(path) {
  if (!path) return "";
  const normalized = path.replaceAll("\\", "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || "";
}

function registerObjectUrl(file) {
  const url = URL.createObjectURL(file);
  objectUrls.push(url);
  return url;
}

function revokeObjectUrls() {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls = [];
}

async function computeRelsMediaSummary(files, filesByRelativePath) {
  const relFiles = files.filter((file) =>
    (file.webkitRelativePath || "").toLowerCase().includes("/story/slides/_rels/")
  );
  const targets = new Set();

  for (const relFile of relFiles) {
    const text = await relFile.text();
    const xmlDoc = new DOMParser().parseFromString(text, "application/xml");
    const relNodes = getElementsByLocalName(xmlDoc, "Relationship");
    relNodes.forEach((rel) => {
      if ((rel.getAttribute("Type") || "").toLowerCase() !== "media") return;
      const target = (rel.getAttribute("Target") || "").replace(/^\/+/, "");
      if (target) targets.add(target.toLowerCase());
    });
  }

  let found = 0;
  targets.forEach((target) => {
    if (hasPathEnding(filesByRelativePath, `/${target}`) || filesByRelativePath.has(target)) {
      found += 1;
    }
  });
  return { total: targets.size, found };
}

async function buildSlideRelsIndex(slideFileName, ctx) {
  if (!ctx || !slideFileName) return null;
  const relFile = findFileByPathEnding(
    ctx.filesByRelativePath,
    `/story/slides/_rels/${slideFileName}.rels`
  );
  if (!relFile) return null;

  const xmlText = await relFile.text();
  const xmlDoc = new DOMParser().parseFromString(xmlText, "application/xml");
  const relNodes = getElementsByLocalName(xmlDoc, "Relationship");

  const result = { image: [], audio: [], video: [], asset: [] };
  relNodes.forEach((rel) => {
    if ((rel.getAttribute("Type") || "").toLowerCase() !== "media") return;
    const target = (rel.getAttribute("Target") || "").replace(/^\/+/, "");
    if (!target) return;

    const file = findFileByPathEnding(ctx.filesByRelativePath, `/${target}`);
    const type = extOf(target);
    const kind = kindFromExt(type);
    result[kind].push({ target, type, file });
  });
  return result;
}

function getElementsByLocalName(doc, localName) {
  return Array.from(doc.getElementsByTagName("*")).filter((el) => el.localName === localName);
}

function hasPathEnding(filesByRelativePath, ending) {
  for (const key of filesByRelativePath.keys()) {
    if (key.endsWith(ending)) return true;
  }
  return false;
}

function findFileByPathEnding(filesByRelativePath, ending) {
  for (const [key, file] of filesByRelativePath.entries()) {
    if (key.endsWith(ending.toLowerCase())) return file;
  }
  return null;
}

function extOf(path) {
  const name = basename(path);
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function kindFromExt(ext) {
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  if (["mp3", "wav", "m4a", "ogg"].includes(ext)) return "audio";
  if (["mp4", "webm"].includes(ext)) return "video";
  return "asset";
}
