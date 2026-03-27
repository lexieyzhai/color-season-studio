const photoInput = document.getElementById("photoInput");
const previewImage = document.getElementById("previewImage");
const zoomRange = document.getElementById("zoomRange");
const xRange = document.getElementById("xRange");
const yRange = document.getElementById("yRange");
const analyzeBtn = document.getElementById("analyzeBtn");
const statusText = document.getElementById("statusText");
const resultBlock = document.getElementById("resultBlock");
const seasonChip = document.getElementById("seasonChip");
const seasonTitle = document.getElementById("seasonTitle");
const seasonSummary = document.getElementById("seasonSummary");
const undertoneValue = document.getElementById("undertoneValue");
const depthValue = document.getElementById("depthValue");
const contrastValue = document.getElementById("contrastValue");
const clarityValue = document.getElementById("clarityValue");
const paletteGrid = document.getElementById("paletteGrid");
const wearText = document.getElementById("wearText");
const avoidText = document.getElementById("avoidText");

const previewWidth = 900;
const previewHeight = 1200;

let imageBitmap = null;
let imageUrl = "";

const seasonLibrary = {
  Spring: {
    summary: "Warm undertones, lighter value, and a cleaner brighter finish point toward Spring.",
    wear: "Go for peach, coral, butter yellow, light camel, warm teal, leaf green, and creamy neutrals.",
    avoid: "Skip icy pastels, blue-heavy grays, and flat dusty shades that dull warm brightness.",
    palette: ["#ffb38a", "#ffd768", "#7fcf92", "#3fb7a8", "#f3dfbf"]
  },
  Autumn: {
    summary: "Warm undertones with deeper or more muted coloring usually land in the Autumn family.",
    wear: "Lean into olive, rust, cinnamon, moss, terracotta, petrol blue, espresso, and rich camel.",
    avoid: "Skip stark white, neon brights, and very icy tones that fight earthy depth.",
    palette: ["#b85c38", "#8a9a3f", "#d09247", "#5c6b3c", "#5a3a2e"]
  },
  Summer: {
    summary: "Cooler undertones with softer contrast and a muted finish often read as Summer.",
    wear: "Use dusty rose, smoky blue, mauve, sage, soft navy, cool taupe, berry, and muted lavender.",
    avoid: "Skip orange-heavy shades, hard black, and ultra-clear saturated warm tones.",
    palette: ["#c28ba4", "#8da3bd", "#9caf9f", "#7b708d", "#d8c7c4"]
  },
  Winter: {
    summary: "Cool undertones paired with stronger contrast or deeper clarity usually place you in Winter.",
    wear: "Reach for jewel tones, crisp black-and-white contrast, cobalt, fuchsia, emerald, plum, and icy accents.",
    avoid: "Skip muddy browns, yellowed beige, and low-energy dusty warm colors.",
    palette: ["#2d3a8c", "#0f7c6a", "#b01763", "#5f173b", "#f5f7fb"]
  }
};

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));

    switch (max) {
      case rn:
        hue = ((gn - bn) / delta) % 6;
        break;
      case gn:
        hue = (bn - rn) / delta + 2;
        break;
      default:
        hue = (rn - gn) / delta + 4;
        break;
    }

    hue *= 60;
    if (hue < 0) hue += 360;
  }

  return { h: hue, s: saturation, l: lightness };
}

function applyPreviewTransform() {
  const zoom = Number(zoomRange.value);
  const x = Number(xRange.value);
  const y = Number(yRange.value);
  previewImage.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
}

function resetResult() {
  resultBlock.classList.add("hidden");
  paletteGrid.innerHTML = "";
}

function loadImage(file) {
  if (!file) return;

  imageBitmap = null;
  if (imageUrl) {
    URL.revokeObjectURL(imageUrl);
  }

  imageUrl = URL.createObjectURL(file);
  previewImage.src = imageUrl;
  previewImage.classList.add("ready");
  statusText.textContent = "Photo loaded. Adjust it so your face sits inside the oval, then run analysis.";
  resetResult();

  const img = new Image();
  img.onload = () => {
    imageBitmap = img;
    statusText.textContent = "Photo loaded. Adjust it so your face sits inside the oval, then run analysis.";
  };
  img.src = imageUrl;
}

function buildCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = previewWidth;
  canvas.height = previewHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const zoom = Number(zoomRange.value);
  const offsetX = Number(xRange.value) * (previewWidth / previewImage.clientWidth);
  const offsetY = Number(yRange.value) * (previewHeight / previewImage.clientHeight);

  const baseScale = Math.max(previewWidth / imageBitmap.width, previewHeight / imageBitmap.height);
  const drawScale = baseScale * zoom;
  const drawWidth = imageBitmap.width * drawScale;
  const drawHeight = imageBitmap.height * drawScale;
  const drawX = (previewWidth - drawWidth) / 2 + offsetX;
  const drawY = (previewHeight - drawHeight) / 2 + offsetY;

  ctx.drawImage(imageBitmap, drawX, drawY, drawWidth, drawHeight);
  return { canvas, ctx };
}

function collectStats(ctx) {
  const imageData = ctx.getImageData(0, 0, previewWidth, previewHeight).data;
  const cx = previewWidth * 0.5;
  const cy = previewHeight * 0.49;
  const rx = previewWidth * 0.18;
  const ry = previewHeight * 0.245;

  let skinCount = 0;
  let featureCount = 0;
  let skinR = 0;
  let skinG = 0;
  let skinB = 0;
  let skinSat = 0;
  let skinLight = 0;
  let warmPixels = 0;
  let coolPixels = 0;
  let featureLight = 0;
  let featureSat = 0;

  for (let y = 0; y < previewHeight; y += 4) {
    for (let x = 0; x < previewWidth; x += 4) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const distance = nx * nx + ny * ny;
      const index = (y * previewWidth + x) * 4;
      const r = imageData[index];
      const g = imageData[index + 1];
      const b = imageData[index + 2];
      const { s, l } = rgbToHsl(r, g, b);

      const isLikelySkin = r > 45 && g > 25 && b > 18 && r > b * 0.88 && r >= g * 0.86 && l > 0.12 && l < 0.92;

      if (distance < 0.56 && isLikelySkin) {
        skinCount += 1;
        skinR += r;
        skinG += g;
        skinB += b;
        skinSat += s;
        skinLight += l;

        if (r + g * 0.35 > b * 1.24) {
          warmPixels += 1;
        } else {
          coolPixels += 1;
        }
      } else if (distance >= 0.56 && distance < 1.08 && y < previewHeight * 0.72) {
        featureCount += 1;
        featureLight += l;
        featureSat += s;
      }
    }
  }

  if (skinCount < 120) {
    return null;
  }

  const avgR = skinR / skinCount;
  const avgG = skinG / skinCount;
  const avgB = skinB / skinCount;
  const avgSat = skinSat / skinCount;
  const avgLight = skinLight / skinCount;
  const avgFeatureLight = featureCount ? featureLight / featureCount : avgLight;
  const avgFeatureSat = featureCount ? featureSat / featureCount : avgSat;

  return {
    avgR,
    avgG,
    avgB,
    avgSat,
    avgLight,
    avgFeatureLight,
    avgFeatureSat,
    warmRatio: warmPixels / skinCount,
    contrast: Math.abs(avgLight - avgFeatureLight)
  };
}

function classifyProfile(stats) {
  const warmth = (stats.avgR - stats.avgB) + (stats.avgG - stats.avgB) * 0.35;
  const undertone = stats.warmRatio > 0.56 || warmth > 18 ? "Warm" : "Cool";

  let depth = "Medium";
  if (stats.avgLight > 0.67) depth = "Light";
  if (stats.avgLight < 0.46) depth = "Deep";

  let contrast = "Balanced";
  if (stats.contrast > 0.2) contrast = "High";
  if (stats.contrast < 0.11) contrast = "Soft";

  const clarityScore = stats.avgSat * 0.7 + stats.avgFeatureSat * 0.3;
  let clarity = "Balanced";
  if (clarityScore > 0.29) clarity = "Clear";
  if (clarityScore < 0.2) clarity = "Muted";

  let season = "Summer";
  if (undertone === "Warm") {
    season = depth === "Light" || clarity === "Clear" ? "Spring" : "Autumn";
    if (depth === "Deep" && clarity !== "Clear") {
      season = "Autumn";
    }
  } else {
    season = contrast === "High" || depth === "Deep" || clarity === "Clear" ? "Winter" : "Summer";
    if (depth === "Light" && clarity === "Muted") {
      season = "Summer";
    }
  }

  return { season, undertone, depth, contrast, clarity };
}

function renderPalette(colors) {
  paletteGrid.innerHTML = "";
  colors.forEach((color) => {
    const swatch = document.createElement("div");
    swatch.className = "swatch";
    swatch.style.background = color;
    paletteGrid.appendChild(swatch);
  });
}

function showResult(profile) {
  const content = seasonLibrary[profile.season];

  seasonChip.textContent = profile.season;
  seasonTitle.textContent = profile.season;
  seasonSummary.textContent = content.summary;
  undertoneValue.textContent = profile.undertone;
  depthValue.textContent = profile.depth;
  contrastValue.textContent = profile.contrast;
  clarityValue.textContent = profile.clarity;
  wearText.textContent = content.wear;
  avoidText.textContent = content.avoid;
  renderPalette(content.palette);

  statusText.textContent = "Analysis complete. Treat this as a styling guide, not an exact scientific diagnosis.";
  resultBlock.classList.remove("hidden");
}

function analyzePhoto() {
  if (!imageBitmap) {
    statusText.textContent = previewImage.src ? "Your photo is still loading. Try again in a second." : "Choose a selfie first.";
    return;
  }

  const { ctx } = buildCanvas();
  const stats = collectStats(ctx);

  if (!stats) {
    statusText.textContent = "I couldn't find enough usable skin tones in the face area. Try a clearer, brighter selfie and center it inside the oval.";
    resetResult();
    return;
  }

  const profile = classifyProfile(stats);
  showResult(profile);
}

photoInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  loadImage(file);
});

[zoomRange, xRange, yRange].forEach((input) => {
  input.addEventListener("input", applyPreviewTransform);
});

analyzeBtn.addEventListener("click", analyzePhoto);
applyPreviewTransform();
