/**
 * Give every authored Descriptor, Focus and Equipment/Cypher Item an image.
 *
 * English source paths and names select the artwork for both locales. Hand-picked
 * existing Focus art is kept; generic defaults and missing images receive a
 * deterministic, locally hosted SVG. No external icon host or Foundry API is
 * required. This is authoring tooling, not browser runtime code.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { root } from "./context.mjs";

const FAMILIES = ["descriptors", "foci", "equipment"];
const DEFAULT_IMAGES = new Set([
  "", "icons/svg/aura.svg", "icons/svg/item-bag.svg",
  "icons/svg/mystery-man.svg", "icons/svg/upgrade.svg"
]);

/** Small pictograms drawn in a normalized 100x100 square. */
const GLYPHS = {
  star: ["M50 8 L61 37 L92 39 L68 59 L76 90 L50 73 L24 90 L32 59 L8 39 L39 37 Z"],
  sun: ["M50 29 A21 21 0 1 1 49.99 29", "M50 5 V17", "M50 83 V95", "M5 50 H17", "M83 50 H95", "M18 18 L27 27", "M73 73 L82 82", "M18 82 L27 73", "M73 27 L82 18"],
  moon: ["M71 12 A39 39 0 1 0 89 70 A34 34 0 0 1 71 12 Z"],
  book: ["M50 22 Q30 11 13 19 V78 Q33 72 50 85 Q67 72 87 78 V19 Q70 11 50 22 Z", "M50 22 V85", "M24 34 Q36 31 43 38", "M57 38 Q68 31 78 34"],
  heart: ["M50 87 L15 54 Q-2 29 18 17 Q37 7 50 29 Q63 7 82 17 Q102 31 85 54 Z"],
  eye: ["M6 50 Q50 5 94 50 Q50 95 6 50 Z", "M50 29 A21 21 0 1 1 49.99 29", "M50 39 A11 11 0 1 1 49.99 39"],
  shield: ["M50 8 L86 21 V49 Q84 74 50 93 Q16 74 14 49 V21 Z", "M50 23 V75", "M31 47 H69"],
  sword: ["M22 79 L71 30 L67 20 L82 8 L92 18 L80 33 L70 29 L21 80", "M18 63 L37 82", "M21 80 L12 89", "M11 82 L18 89"],
  bow: ["M78 9 Q9 50 78 91", "M78 9 L78 91", "M13 50 H91", "M79 39 L91 50 L79 61"],
  fist: ["M22 48 V31 Q22 22 30 22 Q38 22 38 31 V18 Q38 9 46 9 Q54 9 54 18 V21 Q55 10 63 12 Q70 14 69 25 Q77 14 83 21 Q89 27 82 51 L68 78 Q59 91 41 89 L21 70 Z", "M38 31 V44", "M54 21 V43", "M69 25 V43"],
  gear: ["M44 7 H56 L60 20 L70 24 L82 18 L90 29 L81 40 L82 54 L91 65 L84 76 L70 73 L60 79 L57 93 H43 L40 79 L29 74 L16 79 L9 67 L18 55 L18 42 L9 30 L17 19 L30 25 L40 20 Z", "M50 35 A15 15 0 1 1 49.99 35"],
  lightning: ["M59 5 L19 56 H47 L40 95 L83 40 H54 Z"],
  flame: ["M48 5 Q75 37 63 50 Q82 43 78 69 Q74 92 50 94 Q20 94 17 70 Q15 50 34 32 Q32 53 44 57 Q54 49 48 5 Z", "M48 61 Q35 74 45 86 Q59 89 60 75 Z"],
  leaf: ["M88 10 Q11 8 12 62 Q15 91 49 85 Q84 77 88 10 Z", "M17 87 Q47 50 78 27", "M47 56 L32 36", "M55 49 L74 52"],
  brain: ["M49 85 Q39 94 27 81 Q11 79 15 60 Q1 48 18 37 Q14 19 32 17 Q44 3 50 17 Q59 4 71 17 Q90 19 83 38 Q99 52 85 62 Q90 81 72 82 Q60 93 50 85 Z", "M50 17 V85", "M28 42 Q40 36 43 52", "M72 40 Q62 43 59 57"],
  wind: ["M9 32 H64 Q89 32 80 16 Q76 9 66 13", "M7 52 H83 Q95 55 84 67 Q75 73 67 65", "M18 73 H54 Q68 75 61 87 Q55 93 46 87"],
  mask: ["M11 20 Q50 4 89 20 L83 69 Q68 90 50 94 Q32 90 17 69 Z", "M24 47 Q35 38 44 50 Q34 60 24 47 Z", "M56 50 Q65 38 76 47 Q66 60 56 50 Z"],
  mountain: ["M5 87 L37 22 L57 52 L70 36 L95 87 Z", "M25 48 L37 36 L48 48", "M61 52 L70 44 L78 54"],
  figure: ["M50 9 A15 15 0 1 1 49.99 9", "M17 91 Q17 55 50 55 Q83 55 83 91", "M50 55 V84"],
  hammer: ["M20 12 H78 V34 H58 L38 93 L26 88 L46 34 H20 Z"],
  bag: ["M34 13 H66 L62 30 Q91 48 83 78 Q78 94 50 94 Q22 94 17 78 Q10 48 38 30 Z", "M32 30 H68", "M39 48 Q50 54 61 48"],
  potion: ["M39 8 H61", "M43 8 V37 L23 68 Q15 92 50 93 Q85 92 77 68 L57 37 V8", "M32 69 Q50 61 68 69", "M40 79 H60"],
  armor: ["M32 9 L50 22 L68 9 L91 29 L77 50 L77 88 H23 V50 L9 29 Z", "M50 22 V85", "M25 48 H75"],
  tools: ["M17 16 L84 83", "M66 9 Q93 11 86 34 L70 47 L54 31 L66 9 Z", "M9 72 L28 91", "M84 15 L17 83"],
  crystal: ["M50 5 L78 27 L89 68 L50 95 L11 68 L22 27 Z", "M22 27 H78", "M22 27 L50 95 L78 27", "M11 68 H89", "M50 5 V27"],
  compass: ["M50 7 A43 43 0 1 1 49.99 7", "M67 30 L59 60 L31 73 L42 43 Z", "M50 15 V24", "M50 78 V87"],
  wheel: ["M50 8 A42 42 0 1 1 49.99 8", "M50 31 A19 19 0 1 1 49.99 31", "M50 8 V31", "M50 69 V92", "M8 50 H31", "M69 50 H92"],
  food: ["M16 10 V46 Q16 57 31 57 V92", "M29 10 V57", "M41 10 V46 Q41 57 29 57", "M75 10 Q57 22 61 54 H77 V92", "M75 10 V92"]
};

const DESCRIPTOR_SYMBOLS = {
  appealing: "star", bookish: "book", brash: "fist", calm: "moon",
  cautious: "shield", chaotic: "lightning", charming: "heart",
  clever: "brain", compassionate: "heart", creative: "star",
  empathic: "heart", fast: "wind", gloomy: "moon", graceful: "wind",
  guarded: "shield", honorable: "sun", inquisitive: "eye",
  intelligent: "brain", intuitive: "eye", jovial: "sun", kind: "heart",
  mechanical: "gear", mysterious: "mask", mystical: "crystal",
  perceptive: "eye", resilient: "shield", rugged: "mountain",
  skeptical: "eye", stealthy: "mask", strong: "fist",
  "strong-willed": "shield", tough: "armor", virtuous: "sun",
  elf: "leaf", dwarf: "hammer", orc: "fist", human: "figure",
  cyborg: "gear", mutant: "crystal", dragonfolk: "flame",
  hellborn: "flame", halfling: "leaf", gnome: "gear",
  aarak: "wind", "d-nec": "brain", delph: "eye",
  drakain: "shield", naron: "star", prota: "shield",
  rigellian: "compass", stelan: "star", vendeer: "sun",
  zantari: "lightning"
};

function symbolFor(family, relativeFile, document) {
  if (family === "descriptors") {
    const slug = path.posix.basename(relativeFile, ".json");
    return DESCRIPTOR_SYMBOLS[slug] ?? "star";
  }
  if (family === "foci") {
    const slug = path.posix.basename(relativeFile, ".json");
    return {
      "grows-to-towering-heights": "mountain",
      infiltrates: "mask",
      "masters-telekinesis": "brain"
    }[slug] ?? "star";
  }
  const name = String(document.name ?? "").toLowerCase();
  const type = String(document.crdType ?? document.type ?? "");
  const matches = [
    [/\b(arrow|bullet|ammunition|bolt|dart|shot|quiver)\w*/, "bow"],
    [/\b(sword|knife|blade|dagger|saber|katana|rapier|machete|spear|lance|axe)\b/, "sword"],
    [/\b(bow|crossbow|rifle|gun|pistol|revolver|shotgun|blaster|launcher)\b/, "bow"],
    [/\b(shield|barrier|force field)\b/, "shield"],
    [/\b(helmet|armor|armour|vest|mail|suit|greaves|hide)\b/, "armor"],
    [/\b(heal|medical|medic|bandage|antidote|potion|remedy|restor|health)\w*/, "potion"],
    [/\b(lightning|electric|shock|volt|spark)\w*/, "lightning"],
    [/\b(flame|fire|burn|heat|incendiary)\w*/, "flame"],
    [/\b(knowledge|mind|mental|intellect|thought|memory|telepath)\w*/, "brain"],
    [/\b(vision|sight|detect|scanner|goggle|lens|binocular)\w*/, "eye"],
    [/\b(rope|lock|key|tool|kit|wire|grapple|crowbar|pick|hammer|wrench)\w*/, "tools"],
    [/\b(food|ration|meal|water|canteen|bread|bottle)\w*/, "food"],
    [/\b(bag|sack|pack|pouch|purse|chest|case|container)\w*/, "bag"],
    [/\b(vehicle|car|truck|cart|bike|motorcycle|wagon|tank|wheel)\w*/, "wheel"],
    [/\b(map|navigation|compass|beacon|locator)\w*/, "compass"],
    [/\b(speed|wind|flight|jump|teleport|movement)\w*/, "wind"],
    [/\b(energy|power|battery|cell|device|generator|machine|computer|robot)\w*/, "gear"],
    [/\b(invisibility|disguise|illusion|stealth|shadow)\w*/, "mask"]
  ];
  for (const [regex, symbol] of matches) if (regex.test(name)) return symbol;
  if (type === "weapon" || type === "attack") return "sword";
  if (type === "shield") return "shield";
  if (type === "armor") return "armor";
  if (type === "cypher") return "crystal";
  return "bag";
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function svgFor(family, relativeFile, english) {
  const symbol = symbolFor(family, relativeFile, english);
  const seed = hash(family + "/" + relativeFile);
  const baseHue = family === "descriptors" ? 282 :
    english.type === "cypher" ? 262 : family === "foci" ? 211 : 203;
  const hue = (baseHue + seed % 41 - 20 + 360) % 360;
  const initials = String(english.name ?? "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .match(/[A-Za-z0-9]+/g)?.slice(0, 2).map(part => part[0])?.join("")
    ?.toUpperCase() ?? "?";
  const drawing = (GLYPHS[symbol] ?? GLYPHS.star)
    .map(d => '<path d="' + d + '"/>').join("");
  const name = escapeXml(english.name ?? "");
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="' + name + '">',
    '<title>' + name + '</title><defs>',
    '<linearGradient id="bg" x2="1" y2="1"><stop stop-color="hsl(' + hue + ' 35% 24%)"/>',
    '<stop offset="1" stop-color="hsl(' + hue + ' 52% 9%)"/></linearGradient>',
    '<radialGradient id="glow"><stop stop-color="hsl(' + hue + ' 90% 68%)" stop-opacity=".22"/>',
    '<stop offset="1" stop-color="hsl(' + hue + ' 90% 68%)" stop-opacity="0"/></radialGradient></defs>',
    '<rect width="512" height="512" rx="46" fill="url(#bg)"/>',
    '<circle cx="256" cy="232" r="196" fill="url(#glow)"/>',
    '<rect x="21" y="21" width="470" height="470" rx="32" fill="none" stroke="#d6bf89" stroke-width="7" opacity=".8"/>',
    '<circle cx="256" cy="235" r="156" fill="none" stroke="#b4b6c8" stroke-width="5" opacity=".5"/>',
    '<g transform="translate(100 86) scale(3.12)" fill="none" stroke="#f7e5b7" stroke-width="5.3" stroke-linecap="round" stroke-linejoin="round">',
    drawing, '</g>',
    '<rect x="369" y="374" width="104" height="92" rx="22" fill="#111827" stroke="#d6bf89" stroke-width="5"/>',
    '<text x="421" y="435" font-size="43" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="#f8e6bb">' + escapeXml(initials) + '</text>',
    '</svg>\n'
  ].join("");
}

async function writeChanged(file, content) {
  let previous;
  try { previous = await fs.readFile(file, "utf8"); } catch { /* New file. */ }
  if (previous === content) return;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, "utf8");
}

function isSpecificIcon(img) {
  return typeof img === "string" && !DEFAULT_IMAGES.has(img.trim());
}

/**
 * Index each language by its source-backed logical ID, ignoring folder records.
 * Legacy W4 source filenames differ between EN and FR and must not be paired.
 * Other, unmigrated families can use their identical relative source filenames.
 */
async function readItems(family, language) {
  const directory = path.join(root, "packs", family + "-" + language, "_source");
  const byLogicalId = new Map();

  for (const relative of (await fs.readdir(directory, { recursive: true }))
    .filter(file => file.endsWith(".json")).sort()) {
    const file = path.join(directory, relative);
    const document = JSON.parse(await fs.readFile(file, "utf8"));
    if (document._key?.startsWith("!folders!")) continue;
    // Legacy equipment source filenames are odd in English and even in French.
    // Pair by canonical CRD identity; translated names and filenames are not keys.
    const crd = document.flags?.cypherFoundry?.crd;
    const sourceKey = "source:" + family + "/" + relative.replace(/\\/g, "/");
    const baseId = language === "fr"
      ? crd?.sourceLogicalId ?? crd?.logicalId
      : crd?.logicalId;
    const isW4 = family === "equipment" &&
      ["equipment", "weapon", "armor", "shield"].includes(document.crdType);
    // Paired filenames are stable for Descriptor, Focus and Cypher sources.
    // Legacy W4 equipment filenames differ by language (odd/even indexes);
    // pair those by their shared CRD ID plus price level before normalization.
    const logicalId = isW4
      ? baseId && baseId + "::" + String(document.system?.priceCategory ?? "")
      : sourceKey;
    if (!logicalId) {
      throw new Error("Compendium icon record lacks a logical ID: " + file);
    }
    if (byLogicalId.has(logicalId)) {
      throw new Error("Duplicate compendium icon logical ID: " + logicalId);
    }
    byLogicalId.set(logicalId, { document, file, relative });
  }
  return byLogicalId;
}

/**
 * Materialize locally hosted artwork and identical image paths for paired packs.
 * Existing non-generic icons are preferred over generated artwork. CRD logical
 * IDs (not display names or filenames) determine English/French pairs.
 */
export async function synchronizeCompendiumIcons() {
  for (const family of FAMILIES) {
    const english = await readItems(family, "en");
    const french = await readItems(family, "fr");
    if (english.size !== french.size) {
      throw new Error("Compendium icon pairing count differs for " + family);
    }
    for (const [logicalId, item] of english) {
      const counterpart = french.get(logicalId);
      if (!counterpart) {
        throw new Error("Missing French icon counterpart for " + logicalId);
      }
      const en = item.document;
      const fr = counterpart.document;
      const relative = item.relative.replace(/\\/g, "/");
      const generatedUrl = "systems/cypher/assets/compendium/" +
        family + "/" + relative.replace(/\.json$/, ".svg");
      const image = isSpecificIcon(en.img) ? en.img :
        isSpecificIcon(fr.img) ? fr.img : generatedUrl;

      if (image === generatedUrl) {
        const target = path.join(root, "assets", "compendium", family,
          relative.replace(/\.json$/, ".svg"));
        await writeChanged(target, svgFor(family, relative, en));
      }
      if (en.img !== image) {
        en.img = image;
        await writeChanged(item.file, JSON.stringify(en, null, 2) + "\n");
      }
      if (fr.img !== image) {
        fr.img = image;
        await writeChanged(counterpart.file, JSON.stringify(fr, null, 2) + "\n");
      }
    }
  }
}

// CI can produce icon-only artifacts without rerunning unrelated CRD migrations.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await synchronizeCompendiumIcons();
  console.log("Compendium icon artwork synchronized.");
}
