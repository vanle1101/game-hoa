"use client";

import { useId, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { Check, ChevronLeft, ChevronRight, Coins, Eye, LockKeyhole, Minus, Plus, RotateCcw, Save, Search, Shirt, Shuffle, SlidersHorizontal, Sparkles, UserRound, X } from "lucide-react";
import type { Action, GameState } from "@/domain/types";
import type { CosmeticDefinition, CosmeticSlot, ModularAppearance } from "@/character/types";
import { APPEARANCE_PALETTES, COSMETICS, DEFAULT_APPEARANCE, STARTER_OUTFITS } from "@/character/catalog";
import { equipCosmetic, mergeAppearance } from "@/character/ownership";
import { GarmentArtwork } from "./GarmentArtwork";
import "./character-studio.css";

const StudioPreview = dynamic(() => import("./StudioPreview"), {
  ssr: false,
  loading: () => <div className="studio-loading" role="status">Đang dựng nhân vật…</div>,
});

export type CharacterStudioProps = { state: GameState; act: (action: Action) => void; busy?: boolean };
type Draft = { name: string; skin: string; hair: string; appearance: ModularAppearance };
type FaceTab = "hair" | "face" | "eyes" | "brows" | "nose" | "ears" | "mouth" | "skin" | "body" | "details";
type PresetKey = "hairPreset" | "facePreset" | "eyePreset" | "browPreset" | "nosePreset" | "earPreset" | "mouthPreset";

const FACIAL_TABS: [FaceTab, string][] = [
  ["hair", "Tóc"],
  ["face", "Khuôn mặt"],
  ["eyes", "Mắt"],
  ["brows", "Lông mày"],
  ["nose", "Mũi"],
  ["ears", "Tai"],
  ["mouth", "Môi"],
  ["skin", "Làn da"],
  ["body", "Vóc dáng"],
  ["details", "Chi tiết"],
];

const PRESETS: Partial<Record<FaceTab, { key: PresetKey; names: string[] }>> = {
  hair: { key: "hairPreset", names: ["Ngắn tự nhiên", "Vuốt lệch", "Dựng giữa", "Cạo hai bên", "Tỉa nhiều lớp", "Rẽ ngôi", "Vuốt ngược", "Tóc xoăn", "Ngang cằm", "Tóc dài", "Búi tóc", "Cắt sát"] },
  face: { key: "facePreset", names: ["Trái xoan", "Trái tim", "Góc cạnh", "Tròn", "Thuôn dài", "Vuông"] },
  eyes: { key: "eyePreset", names: ["Mềm mại", "Tập trung", "Hạnh nhân", "Đuôi cao", "Tròn rộng", "Mí thấp"] },
  brows: { key: "browPreset", names: ["Tự nhiên", "Vòm cao", "Ngang", "Góc rõ", "Thanh mảnh", "Đậm"] },
  nose: { key: "nosePreset", names: ["Mềm mại", "Sống thẳng", "Cánh rộng", "Thanh mảnh", "Sống cao", "Đầu tròn"] },
  ears: { key: "earPreset", names: ["Cân đối", "Nhỏ gọn", "Vành rộng", "Đầu nhọn"] },
  mouth: { key: "mouthPreset", names: ["Tự nhiên", "Mỉm cười", "Đầy đặn", "Thanh mảnh", "Miệng rộng", "Cánh cung"] },
};

const SLOTS: [CosmeticSlot, string][] = [
  ["top", "Áo"],
  ["outerwear", "Áo khoác"],
  ["bottom", "Quần"],
  ["shoes", "Giày"],
  ["headwear", "Mũ"],
  ["gloves", "Găng tay"],
  ["eyewear", "Kính mắt"],
  ["face", "Mặt nạ"],
  ["back", "Đồ đeo lưng"],
  ["jewelry", "Trang sức"],
  ["accessory", "Phụ kiện"],
];

const RARITIES = { common: "Phổ thông", uncommon: "Độc đáo", rare: "Hiếm", epic: "Sử thi", legendary: "Huyền thoại", mythic: "Thần thoại" };
const COLLECTIONS: Record<string, string> = {
  "starter-signal": "Tín hiệu đầu tiên",
  "starter-corporate": "Công sở tương lai",
  "starter-technician": "Kỹ thuật đêm",
  "violet-afterglow": "Dư âm tím",
  "dawn-shift": "Ca bình minh",
  "ember-line": "Vệt lửa",
  "silver-index": "Dấu bạc",
  "signal-grid": "Lưới tín hiệu",
  "black-circuit": "Mạch đen",
  "aurora-weather": "Cực quang",
  "v7-neon-tailoring": "Đường may Neon",
  "v7-urban-forms": "Dáng phố",
};
const OUTFIT_NAMES: Record<string, string> = { "street-runner": "Nhịp phố", "neo-corporate": "Công sở tương lai", "night-technician": "Kỹ thuật đêm" };

const fromState = (state: GameState): Draft => ({
  name: state.character.name,
  skin: state.character.skin,
  hair: state.character.hair,
  appearance: mergeAppearance(state.character.appearance, {
    hairPreset: state.character.appearance?.hairPreset ?? ({ short: 0, swept: 1, mohawk: 2 }[state.character.hairstyle]),
  }),
});

const searchable = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d");
const collectionName = (item: CosmeticDefinition) => COLLECTIONS[item.collection ?? ""] ?? item.collection ?? "Bộ sưu tập thành phố";
const itemName = (item: CosmeticDefinition) => item.name.replace(/^Outerwear /, "Áo khoác ").replace(/^Ear Cuff Starter$/, "Khuyên vành tai khởi đầu").replace(/^Overshirt /, "Áo sơ mi ").replace(/^Trench /, "Áo khoác dài ").replace(/^Parka /, "Áo khoác ấm ").replace(/^Pulse High-Tops$/, "Giày cổ cao Pulse").replace(/^Mono Loafers$/, "Giày lười Mono");

function GarmentThumbnail({ slot, color = "#72d3dc", model = "" }: { slot: CosmeticSlot; color?: string; model?: string }) {
  const paths: Record<CosmeticSlot, string> = {
    top: "M24 18 36 13 44 18 56 13 68 18 80 33 67 43 61 35 62 78 30 78 31 35 25 43 12 33Z",
    outerwear: "M29 16 39 12 48 22 57 12 67 16 79 48 68 54 61 33 67 85 49 85 46 53 43 85 25 85 31 33 24 54 13 48Z",
    bottom: "M28 15H68L66 80H51L48 43 44 80H28Z",
    shoes: "M15 30H34L38 48 49 54V67H10V54L15 48ZM57 25H76L80 43 89 50V63H53V48L57 43Z",
    headwear: model === "beanie" ? "M23 55V43C23 12 73 12 73 43V55ZM19 54H77V68H19Z" : "M22 53V43C22 12 73 12 73 43V53L87 62H25L12 56Z",
    accessory: model.includes("scarf") ? "M26 22Q48 35 69 22L72 37 56 44 64 80 48 84 40 47 23 38Z" : model.includes("visor") ? "M14 34 82 34 77 57 57 59 48 49 39 59 19 57Z" : model.includes("cuff") ? "M60 21C28 9 22 73 56 77L60 65C39 68 40 33 61 34Z" : "M36 14H60V33H69V63H60V82H36V63H27V33H36ZM36 39V57H60V39Z",
    gloves: "M24 77 17 52 20 31 27 31 28 48 30 21 37 21 38 46 41 18 48 19 47 47 52 25 59 28 54 57 64 48 70 54 55 77Z",
    eyewear: "M12 35H40L46 40 52 35H82L77 59H56L49 45 43 59H17Z",
    face: "M18 33 48 44 78 33 72 65 48 79 24 65Z",
    back: "M32 26V17Q48 8 64 17V26L74 35V78H22V35ZM32 48H64V70H32Z",
    jewelry: "M20 23C16 77 80 77 76 23L68 22C72 63 24 63 28 22ZM41 62H55V78H41Z",
  };
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className="studio-thumbnail">
      <ellipse cx="48" cy="87" rx="30" ry="4" fill="#000" opacity=".25" />
      <path d={paths[slot]} fill={color} stroke="#c4e6f0" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={slot === "bottom" ? "M29 25H67M48 17V40" : slot === "outerwear" ? "M39 13 43 34 48 24 53 34 57 13M48 25V80" : slot === "top" ? "M36 14Q43 32 56 14M34 69H58" : "M31 51H63"} fill="none" stroke="#e0f8ff" opacity=".5" strokeWidth="2" />
    </svg>
  );
}

function FaceThumbnail({ tab, index, skin, hair }: { tab: FaceTab; index: number; skin: string; hair: string }) {
  const faceWidth = tab === "face"
    ? (index === 0 ? 21 : index === 1 ? 23 : index === 2 ? 20 : index === 3 ? 24 : index === 4 ? 19 : 23)
    : 21;
  const faceHeight = tab === "face"
    ? (index === 3 ? 24 : index === 4 ? 29 : 26)
    : 26;

  const hairPath = (idx: number) => {
    switch (idx) {
      case 0: return "M26 40Q18 10 48 9Q78 10 70 40L60 26 48 21 32 30Z";
      case 1: return "M24 42Q18 10 50 8Q82 8 72 40L64 20 40 16 26 28Z";
      case 2: return "M34 38Q36 2 48 0Q60 2 62 38L54 22 48 18 42 22Z";
      case 3: return "M30 36Q28 12 48 10Q68 12 66 36L60 22 48 18 36 22Z";
      case 4: return "M22 45 25 22 36 12 48 6 60 12 71 22 74 45 66 34 58 20 48 24 38 20 30 34Z";
      case 5: return "M24 44 26 24 38 12 47 18 48 30 49 18 58 12 70 24 72 44 62 26 48 24 34 26Z";
      case 6: return "M25 36Q22 8 48 6Q74 8 71 36L66 18 48 14 30 18Z";
      case 7: return "M23 42Q15 26 26 18Q28 6 42 7Q48 3 56 6Q70 6 71 18Q81 26 73 42L66 30 58 22 48 24 38 22 30 30Z";
      case 8: return "M22 62 24 24Q22 8 48 8Q74 8 72 24L74 62 66 48 60 26 48 20 36 26 30 48Z";
      case 9: return "M20 78 23 24Q22 7 48 7Q74 7 73 24L76 78 68 62 62 28 48 20 34 28 28 62Z";
      case 10: return "M26 38Q22 10 48 9Q74 10 70 38L62 24 48 18 34 24Z";
      case 11: return "M28 38Q26 14 48 13Q70 14 68 38L64 24 48 20 32 24Z";
      default: return "M26 40Q18 10 48 9Q78 10 70 40L60 26 48 21 32 30Z";
    }
  };

  const hairIndex = tab === "hair" ? index : 0;
  const browY = tab === "brows" ? 36 + (index === 1 ? -2 : index === 2 ? 1 : index === 3 ? -1 : 0) : 36;
  const browWidth = tab === "brows" ? (index === 4 ? 1 : index === 5 ? 2.8 : 1.8) : 1.8;
  const eyeRy = tab === "eyes" ? (index === 1 ? 1.5 : index === 2 ? 1.9 : index === 4 ? 3.2 : index === 5 ? 1.4 : 2.2) : 2.2;
  const eyeRx = tab === "eyes" ? (index === 2 ? 4.8 : index === 4 ? 4.2 : 3.8) : 3.8;
  const noseY = tab === "nose" ? (index === 4 ? 50 : index === 5 ? 54 : 52) : 52;
  const mouthY = tab === "mouth" ? (index === 1 ? 61 : index === 2 ? 63 : 62) : 62;
  const mouthStroke = tab === "mouth" ? (index === 2 ? 2.5 : index === 3 ? 1.2 : 1.8) : 1.8;
  const earRx = tab === "ears" ? (index === 1 ? 3 : index === 2 ? 6 : index === 3 ? 4 : 4) : 4;
  const earRy = tab === "ears" ? (index === 1 ? 5 : index === 2 ? 8 : index === 3 ? 9 : 7) : 7;

  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className="studio-face-thumbnail">
      <rect width="96" height="96" fill="#132235" rx="6" />
      <path d="M17 96Q20 74 38 72V64H58V72Q77 74 80 96" fill="#26384c" />
      <ellipse cx="48" cy="44" rx={faceWidth} ry={faceHeight} fill={skin} />
      {tab === "ears" && (
        <>
          <ellipse cx={48 - faceWidth - 1} cy="45" rx={earRx} ry={earRy} fill={skin} />
          <ellipse cx={48 + faceWidth + 1} cy="45" rx={earRx} ry={earRy} fill={skin} />
        </>
      )}
      <path d={hairPath(hairIndex)} fill={hair} />
      {tab === "hair" && hairIndex === 10 && <circle cx="48" cy="7" r="8" fill={hair} />}
      <path d={`M34 ${browY}L42 ${browY - 1}M54 ${browY - 1}L62 ${browY}`} stroke={hair} strokeWidth={browWidth} strokeLinecap="round" />
      <ellipse cx="38" cy="43" rx={eyeRx} ry={eyeRy} fill="#1d2836" />
      <ellipse cx="58" cy="43" rx={eyeRx} ry={eyeRy} fill="#1d2836" />
      <circle cx="39" cy="42" r="0.9" fill="#edf4ff" opacity="0.8" />
      <circle cx="59" cy="42" r="0.9" fill="#edf4ff" opacity="0.8" />
      <path d={`M48 43 45 ${noseY}H51`} fill="none" stroke="#7a554a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M40 ${mouthY}Q48 ${tab === "mouth" && index === 1 ? mouthY + 3 : mouthY + 1} 56 ${mouthY}`} fill="none" stroke="#7a4848" strokeWidth={mouthStroke} strokeLinecap="round" />
    </svg>
  );
}

function Palette({ label, colors, value, onChange }: { label: string; colors: readonly string[]; value: string; onChange: (color: string) => void }) {
  return (
    <fieldset className="studio-palette">
      <legend>
        {label}
        <span>{colors.length} màu</span>
      </legend>
      <div>
        {colors.map((color, index) => (
          <button
            key={color}
            type="button"
            aria-label={`${label} ${index + 1}, ${color}`}
            aria-pressed={value.toLowerCase() === color.toLowerCase()}
            title={color}
            style={{ "--swatch": color } as CSSProperties}
            onClick={() => onChange(color)}
          >
            {value.toLowerCase() === color.toLowerCase() && <Check size={16} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function CharacterStudio({ state, act, busy = false }: CharacterStudioProps) {
  const nameErrorId = useId();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [section, setSection] = useState<"appearance" | "wardrobe">("appearance");
  const [tab, setTab] = useState<FaceTab>("hair");
  const [slot, setSlot] = useState<CosmeticSlot>("top");
  const [focus, setFocus] = useState<"head" | "body">("body");
  const [reset, setReset] = useState(0);
  const [azimuth, setAzimuth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [compare, setCompare] = useState(false);
  const [preview, setPreview] = useState<Partial<Record<CosmeticSlot, string>> | null>(null);
  const [filter, setFilter] = useState<"all" | "owned" | "free" | "shop">("all");
  const [rarity, setRarity] = useState("all");
  const [search, setSearch] = useState("");

  const saved = fromState(state);
  const current = draft ?? saved;
  const dirty = JSON.stringify(current) !== JSON.stringify(saved);
  const shown = compare ? saved : current;
  const owned = new Set(state.ownedCosmetics ?? []);
  const equipped = state.equippedCosmetics ?? {};
  const level = Math.floor(Math.sqrt(Math.max(0, state.character.xp) / 100)) + 1;
  const selected = PRESETS[tab];
  const previewCosmetics = compare ? equipped : preview ?? equipped;

  const change = (patch: Partial<Draft>) => {
    setCompare(false);
    setDraft({ ...current, ...patch });
  };

  const appearance = (patch: Partial<ModularAppearance>) => change({ appearance: mergeAppearance(current.appearance, patch) });

  const wardrobeItems = COSMETICS.filter(
    item =>
      item.slot === slot &&
      (filter !== "owned" || owned.has(item.id)) &&
      (filter !== "free" || item.price === 0) &&
      (filter !== "shop" || !owned.has(item.id)) &&
      (rarity === "all" || (item.rarity ?? "common") === rarity) &&
      searchable(`${itemName(item)} ${item.description} ${collectionName(item)} ${item.collection ?? ""}`).includes(searchable(search.trim())),
  );

  const chooseTab = (next: FaceTab) => {
    setTab(next);
    setFocus(next === "body" || next === "details" ? "body" : "head");
  };

  const tryItem = (item: CosmeticDefinition) => {
    setPreview(equipCosmetic(preview ?? equipped, item));
    setCompare(false);
  };

  const randomize = () => {
    const pick = (count: number) => Math.floor(Math.random() * count);
    change({
      skin: APPEARANCE_PALETTES.skin[pick(APPEARANCE_PALETTES.skin.length)],
      hair: APPEARANCE_PALETTES.hair[pick(APPEARANCE_PALETTES.hair.length)],
      appearance: mergeAppearance(current.appearance, {
        hairPreset: pick(12),
        facePreset: pick(6),
        eyePreset: pick(6),
        browPreset: pick(6),
        nosePreset: pick(6),
        earPreset: pick(4),
        mouthPreset: pick(6),
        eyeColor: APPEARANCE_PALETTES.iris[pick(APPEARANCE_PALETTES.iris.length)],
      }),
    });
  };

  const save = () => {
    const name = current.name.trim();
    if (!name || busy) return;
    setDraft({ ...current, name });
    act({ type: "character.update", name, skin: current.skin, hair: current.hair, appearance: current.appearance });
  };

  const resetCamera = () => {
    setAzimuth(0);
    setZoom(1);
    setFocus("body");
    setReset(value => value + 1);
  };

  return (
    <section className="character-studio" aria-label="Xưởng tạo nhân vật" data-reduced-motion={state.settings.reducedMotion}>
      <header className="studio-heading">
        <div>
          <span className="studio-kicker">NEON HAVEN / XƯỞNG NHÂN VẬT</span>
          <h2>Tạo dấu ấn riêng<span>.</span></h2>
          <p>Thiết lập diện mạo, phong cách và đường nét cá nhân trong thế giới Neon Haven.</p>
        </div>
        <div className="studio-heading-meta">
          <span className="studio-level">CÔNG DÂN · CẤP {level}</span>
          <span className="studio-wallet" aria-label={`${state.gold.toLocaleString("vi-VN")} vàng`}>
            <Coins size={20} aria-hidden="true" />
            {state.gold.toLocaleString("vi-VN")} <small>VÀNG</small>
          </span>
        </div>
      </header>

      <div className="studio-layout">
        <aside className="studio-navigation" aria-label="Danh mục tùy chỉnh">
          <div className="studio-section-tabs">
            <button type="button" aria-pressed={section === "appearance"} onClick={() => setSection("appearance")}>
              <SlidersHorizontal size={17} aria-hidden="true" />
              Ngoại hình
            </button>
            <button
              type="button"
              aria-pressed={section === "wardrobe"}
              onClick={() => {
                setSection("wardrobe");
                setFocus("body");
              }}
            >
              <Shirt size={17} aria-hidden="true" />
              Tủ đồ
            </button>
          </div>
          <span className="studio-nav-label">{section === "appearance" ? "ĐƯỜNG NÉT CỦA BẠN" : "PHỐI THEO CÁCH BẠN"}</span>
          <div className="studio-category-list" role="group" aria-label={section === "appearance" ? "Nhóm ngoại hình" : "Loại trang phục"}>
            {section === "appearance"
              ? FACIAL_TABS.map(([id, label], index) => (
                  <button type="button" aria-pressed={tab === id} key={id} onClick={() => chooseTab(id)}>
                    <span className="studio-nav-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    {label}
                    <ChevronRight size={13} aria-hidden="true" />
                  </button>
                ))
              : SLOTS.map(([id, label]) => (
                  <button
                    type="button"
                    aria-label={label}
                    aria-pressed={slot === id}
                    key={id}
                    onClick={() => {
                      setSlot(id);
                      setFocus(["headwear", "eyewear", "face", "jewelry"].includes(id) ? "head" : "body");
                    }}
                  >
                    <GarmentThumbnail slot={id} />
                    {label}
                    <span className="studio-slot-count">{COSMETICS.filter(item => item.slot === id).length}</span>
                  </button>
                ))}
          </div>
          <div className="studio-nav-note">
            <Sparkles size={18} aria-hidden="true" />
            <p>Không có khuôn mẫu.<br />Chỉ có chính bạn.</p>
          </div>
        </aside>

        <div className="studio-stage">
          <div className="studio-stage-top">
            <span role="status">
              <i aria-hidden="true" />
              {compare ? "BẢN ĐÃ LƯU" : preview ? "ĐANG THỬ TRANG PHỤC" : dirty ? "THAY ĐỔI CHƯA LƯU" : "NHÂN VẬT CỦA BẠN"}
            </span>
            <button type="button" onClick={() => setCompare(value => !value)} aria-pressed={compare}>
              <Eye size={14} aria-hidden="true" />
              {compare ? "Về bản thử" : "So sánh"}
            </button>
          </div>

          <div className="studio-stage-grid" aria-hidden="true" />

          <div className="studio-stage-platform" aria-hidden="true" data-focus={focus}>
            <div className="studio-platform-spot-cyan" />
            <div className="studio-platform-spot-magenta" />
            <div className="studio-platform-projector">
              <div className="studio-platform-disc" />
              <div className="studio-platform-ring-magenta" />
              <div className="studio-platform-ring-cyan" />
              <div className="studio-platform-glow" />
              <div className="studio-platform-ticks" />
              <div className="studio-platform-beam" />
            </div>
          </div>

          <div className="studio-canvas">
            <StudioPreview
              skin={shown.skin}
              hair={shown.hair}
              outfit={state.character.outfit}
              hairstyle={state.character.hairstyle}
              appearance={shown.appearance}
              cosmetics={previewCosmetics}
              quality={state.settings.graphics}
              reducedMotion={state.settings.reducedMotion}
              cameraFocus={focus}
              cameraReset={reset}
              cameraAzimuth={azimuth}
              cameraZoom={zoom}
            />
          </div>

          <div className="studio-stage-name">
            <span>CẤP {level} · DIỆN MẠO CỦA BẠN</span>
            <strong>{shown.name || "Nhân vật"}</strong>
            <small>{focus === "head" ? "Cận mặt" : "Toàn thân"} · Khung nhìn 3D trực tiếp</small>
          </div>

          <div className="studio-camera">
            <div className="studio-focus-buttons">
              <button type="button" aria-pressed={focus === "body"} onClick={() => setFocus("body")}>
                <UserRound size={15} aria-hidden="true" />
                Toàn thân
              </button>
              <button type="button" aria-pressed={focus === "head"} onClick={() => setFocus("head")}>
                <Eye size={15} aria-hidden="true" />
                Cận mặt
              </button>
              <button type="button" onClick={() => { setAzimuth(Math.PI / 2); setZoom(1); setReset(value => value + 1); }}>Góc nghiêng</button>
              <button type="button" onClick={() => { setAzimuth(Math.PI); setZoom(1); setReset(value => value + 1); }}>Mặt sau</button>
            </div>
            <div className="studio-orbit-buttons" role="group" aria-label="Điều khiển góc nhìn">
              <button type="button" onClick={() => setAzimuth(value => value - Math.PI / 8)} aria-label="Xoay trái" title="Xoay trái">
                <ChevronLeft size={17} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setAzimuth(value => value + Math.PI / 8)} aria-label="Xoay phải" title="Xoay phải">
                <ChevronRight size={17} aria-hidden="true" />
              </button>
              <button type="button" disabled={zoom <= 0.65} onClick={() => setZoom(value => Math.max(0.65, Number((value - 0.15).toFixed(2))))} aria-label="Thu nhỏ" title="Thu nhỏ">
                <Minus size={17} aria-hidden="true" />
              </button>
              <button type="button" disabled={zoom >= 1.8} onClick={() => setZoom(value => Math.min(1.8, Number((value + 0.15).toFixed(2))))} aria-label="Phóng to" title="Phóng to">
                <Plus size={17} aria-hidden="true" />
              </button>
              <button type="button" onClick={resetCamera} aria-label="Đặt lại góc nhìn" title="Đặt lại góc nhìn">
                <RotateCcw size={16} aria-hidden="true" />
              </button>
            </div>
            <small className="studio-camera-hint">Kéo chuột để xoay 360° · Cuộn để thu/phóng</small>
          </div>
        </div>

        <div className="studio-controls">
          {section === "appearance" ? (
            <>
              <label className="studio-name">
                <div className="studio-name-header">
                  <span>Tên nhân vật</span>
                  <small className="studio-name-counter">{current.name.length}/40</small>
                </div>
                <input
                  maxLength={40}
                  value={current.name}
                  aria-label="Tên nhân vật"
                  aria-invalid={!current.name.trim()}
                  aria-describedby={!current.name.trim() ? nameErrorId : undefined}
                  placeholder="Nhập tên nhân vật…"
                  onChange={event => change({ name: event.target.value })}
                />
                {!current.name.trim() && <small id={nameErrorId}>Vui lòng nhập tên nhân vật.</small>}
              </label>

              <div className="studio-edit-panel" role="region" aria-label={FACIAL_TABS.find(([id]) => id === tab)?.[1]}>
                <div className="studio-edit-title">
                  <div>
                    <span className="studio-kicker">TÙY CHỈNH DIỆN MẠO</span>
                    <h3>{FACIAL_TABS.find(([id]) => id === tab)?.[1]}</h3>
                  </div>
                  {selected && <span>{selected.names.length} kiểu</span>}
                </div>

                {selected && (
                  <>
                    <div className="studio-preset-grid">
                      {selected.names.map((name, index) => (
                        <button
                          type="button"
                          key={name}
                          aria-pressed={(current.appearance[selected.key] ?? 0) === index}
                          onClick={() => appearance({ [selected.key]: index })}
                        >
                          <FaceThumbnail tab={tab} index={index} skin={current.skin} hair={current.hair} />
                          <span>{name}</span>
                          {(current.appearance[selected.key] ?? 0) === index && (
                            <Check size={14} className="studio-selected-check" aria-hidden="true" />
                          )}
                        </button>
                      ))}
                    </div>
                    <p className="studio-art-note">Hình minh họa 2D · Xem mô hình 3D trực tiếp trên bục trung tâm.</p>
                  </>
                )}

                {tab === "hair" && <Palette label="Màu tóc" colors={APPEARANCE_PALETTES.hair} value={current.hair} onChange={hair => change({ hair })} />}
                {tab === "eyes" && <Palette label="Màu mắt" colors={APPEARANCE_PALETTES.iris} value={current.appearance.eyeColor} onChange={eyeColor => appearance({ eyeColor })} />}
                {tab === "skin" && (
                  <>
                    <Palette label="Tông da" colors={APPEARANCE_PALETTES.skin} value={current.skin} onChange={skin => change({ skin })} />
                    <p className="studio-hint">Ánh sáng được giữ nhất quán khi thử tông da.</p>
                  </>
                )}
                {tab === "body" && (
                  <>
                    <fieldset className="studio-presentation">
                      <legend>Phong cách thể hiện</legend>
                      <div>
                        {([["masculine", "Nam tính"], ["feminine", "Nữ tính"], ["neutral", "Trung tính"]] as const).map(([id, label]) => (
                          <button
                            type="button"
                            key={id}
                            aria-pressed={(current.appearance.presentation ?? "neutral") === id}
                            onClick={() => appearance({ presentation: id })}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <p className="studio-hint">Độc lập với vóc dáng và trang phục.</p>
                    </fieldset>
                    <div className="studio-body-presets" role="group" aria-label="Vóc dáng">
                      {([["slim", "Thanh mảnh"], ["balanced", "Cân đối"], ["athletic", "Thể thao"]] as const).map(([id, label]) => (
                        <button
                          type="button"
                          key={id}
                          aria-pressed={current.appearance.body === id}
                          onClick={() => appearance({ body: id })}
                        >
                          <UserRound size={30} strokeWidth={id === "athletic" ? 2.4 : id === "slim" ? 1 : 1.7} aria-hidden="true" />
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="studio-range">
                      Chiều cao <output>{Math.round(current.appearance.height * 100)}%</output>
                      <input
                        type="range"
                        min={0.85}
                        max={1.15}
                        step={0.01}
                        value={current.appearance.height}
                        onChange={event => appearance({ height: Number(event.target.value) })}
                      />
                    </label>
                    <label className="studio-range">
                      Độ rộng vai <output>{Math.round(current.appearance.shoulderWidth * 100)}%</output>
                      <input
                        type="range"
                        min={0.8}
                        max={1.2}
                        step={0.01}
                        value={current.appearance.shoulderWidth}
                        onChange={event => appearance({ shoulderWidth: Number(event.target.value) })}
                      />
                    </label>
                  </>
                )}
                {tab === "details" && (
                  <div className="studio-details">
                    {([
                      ["beard", "Râu", "Lớp râu ngắn quanh cằm"],
                      ["tattoos", "Hình xăm", "Dấu mực trên cẳng tay"],
                      ["piercings", "Khuyên tai", "Khuyên kim loại hai bên"],
                      ["cyberware", "Cấy ghép công nghệ", "Điểm nhấn ở gò má"],
                    ] as const).map(([key, label, description]) => (
                      <label key={key}>
                        <div>
                          <strong>{label}</strong>
                          <small>{description}</small>
                        </div>
                        <input
                          type="checkbox"
                          checked={current.appearance[key] ?? false}
                          onChange={event => appearance({ [key]: event.target.checked })}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="studio-draft-tools">
                <button type="button" onClick={randomize}>
                  <Shuffle size={14} aria-hidden="true" />
                  Ngẫu nhiên
                </button>
                <button
                  type="button"
                  onClick={() => change({ appearance: mergeAppearance(DEFAULT_APPEARANCE), skin: "#c99573", hair: "#171b2e" })}
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  Đặt lại ngoại hình
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="studio-wardrobe-heading">
                <span className="studio-kicker">BỘ SƯU TẬP CỦA BẠN</span>
                <h3>{SLOTS.find(([id]) => id === slot)?.[1]}</h3>
                <p>Thử tự do trên nhân vật. Chỉ mua khi bạn sẵn sàng.</p>
              </div>

              <div className="studio-wardrobe-toolbar">
                <label className="studio-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    aria-label="Tìm trang phục"
                    placeholder="Tìm trong danh mục…"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                  />
                </label>
                <div className="studio-filter-row">
                  <select aria-label="Lọc tủ đồ" value={filter} onChange={event => setFilter(event.target.value as typeof filter)}>
                    <option value="all">Tất cả</option>
                    <option value="owned">Đã sở hữu</option>
                    <option value="free">Miễn phí</option>
                    <option value="shop">Chưa sở hữu</option>
                  </select>
                  <select aria-label="Lọc độ hiếm" value={rarity} onChange={event => setRarity(event.target.value)}>
                    <option value="all">Mọi độ hiếm</option>
                    {Object.entries(RARITIES).map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="studio-results">
                  <span>{wardrobeItems.length} món phù hợp</span>
                  {equipped[slot] && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setPreview(null);
                        act({ type: "cosmetic.unequip", slot });
                      }}
                    >
                      Tháo món đang mặc
                    </button>
                  )}
                </div>
              </div>

              <div className="studio-wardrobe-grid">
                {wardrobeItems.map(item => {
                  const has = owned.has(item.id);
                  const wearing = equipped[item.slot] === item.id;
                  const trying = preview?.[item.slot] === item.id;
                  const locked = level < (item.level ?? 1);
                  const unaffordable = state.gold < item.price;
                  const actionLabel = wearing
                    ? "Đang mặc"
                    : locked
                      ? `Mở ở cấp ${item.level}`
                      : has
                        ? "Mặc ngay"
                        : unaffordable
                          ? `Cần ${item.price.toLocaleString("vi-VN")} vàng`
                          : item.price === 0
                            ? "Nhận miễn phí"
                            : `Mua · ${item.price.toLocaleString("vi-VN")} vàng`;

                  return (
                    <article key={item.id} className={`${trying ? "is-preview" : ""} ${wearing ? "is-equipped" : ""} rarity-${item.rarity ?? "common"}`}>
                      <button
                        type="button"
                        className="studio-item-preview"
                        aria-label={`Thử ${item.name}`}
                        aria-pressed={trying}
                        onClick={() => tryItem(item)}
                      >
                        <span className="studio-item-rarity">{RARITIES[item.rarity ?? "common"]}</span>
                        <span className="studio-item-artwork">
                          <GarmentArtwork slot={item.slot} color={item.color} model={item.model} />
                        </span>
                        <strong>{itemName(item)}</strong>
                        <span className="studio-item-state" data-owned={has || wearing}>
                          {wearing ? <Check size={12} aria-hidden="true" /> : locked ? <LockKeyhole size={12} aria-hidden="true" /> : null}
                          {wearing ? "Đang mặc" : has ? "Đã sở hữu" : locked ? `Khóa · Cấp ${item.level}` : item.price === 0 ? "Miễn phí" : "Chưa sở hữu"}
                        </span>
                        {!has && item.price > 0 && <small className="studio-item-price">{item.price.toLocaleString("vi-VN")} vàng</small>}
                        <em>
                          <Eye size={12} aria-hidden="true" />
                          {trying ? "Đang xem trước" : "Thử trên nhân vật"}
                        </em>
                      </button>
                      <div className="studio-item-meta">
                        <span
                          className="studio-material-swatch"
                          role="img"
                          style={{ "--swatch": item.color ?? "#72d3dc" } as CSSProperties}
                          title={`Màu ${item.color ?? "mặc định"}`}
                          aria-label={`Màu trang phục ${item.color ?? "mặc định"}`}
                        />
                        <p className="studio-item-collection">{collectionName(item)}</p>
                      </div>
                      <button
                        type="button"
                        className={has ? "" : "studio-primary"}
                        aria-label={`${actionLabel}: ${itemName(item)}`}
                        disabled={busy || wearing || locked || (!has && unaffordable)}
                        onClick={() => {
                          if (has) {
                            setPreview(null);
                            act({ type: "cosmetic.equip", cosmeticId: item.id });
                          } else {
                            act({ type: "cosmetic.buy", cosmeticId: item.id });
                          }
                        }}
                      >
                        {wearing ? <Check size={13} aria-hidden="true" /> : locked ? <LockKeyhole size={13} aria-hidden="true" /> : !has && item.price > 0 ? <Coins size={13} aria-hidden="true" /> : null}
                        {actionLabel}
                      </button>
                    </article>
                  );
                })}
              </div>

              {!wardrobeItems.length && (
                <div className="studio-empty">
                  <Shirt size={28} aria-hidden="true" />
                  <strong>Chưa có trang phục phù hợp</strong>
                  <p>{COSMETICS.some(item => item.slot === slot) ? "Thử tìm từ khác hoặc bỏ bộ lọc." : "Danh mục này chưa có vật phẩm. Hãy khám phá các nhóm khác."}</p>
                  {(search || filter !== "all" || rarity !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setFilter("all");
                        setRarity("all");
                      }}
                    >
                      Xóa bộ lọc
                    </button>
                  )}
                </div>
              )}

              {preview && (
                <button
                  type="button"
                  className="studio-clear-preview"
                  onClick={() => {
                    setPreview(null);
                    setCompare(false);
                  }}
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                  Trở về trang phục đang mặc
                </button>
              )}

              <details className="studio-starters">
                <summary>
                  <Sparkles size={15} aria-hidden="true" />
                  Bộ đồ khởi đầu miễn phí
                </summary>
                {STARTER_OUTFITS.map(outfit => (
                  <div className="studio-outfit" key={outfit.id}>
                    <button
                      type="button"
                      aria-label={`Thử bộ ${OUTFIT_NAMES[outfit.id]}`}
                      onClick={() => {
                        setPreview(
                          outfit.items.reduce((next, id) => {
                            const item = COSMETICS.find(candidate => candidate.id === id);
                            return item ? equipCosmetic(next, item) : next;
                          }, { ...equipped }),
                        );
                        setCompare(false);
                      }}
                    >
                      <span className="studio-outfit-colors">
                        {outfit.items.map(id => (
                          <i key={id} style={{ background: COSMETICS.find(item => item.id === id)?.color }} />
                        ))}
                      </span>
                      <span>{OUTFIT_NAMES[outfit.id]}</span>
                    </button>
                    <button
                      type="button"
                      disabled={
                        busy ||
                        !outfit.items.every(id => owned.has(id) && level >= (COSMETICS.find(item => item.id === id)?.level ?? 1)) ||
                        outfit.items.every(id => Object.values(equipped).includes(id))
                      }
                      onClick={() => {
                        setPreview(null);
                        act({ type: "cosmetic.outfit", outfitId: outfit.id });
                      }}
                    >
                      {outfit.items.every(id => Object.values(equipped).includes(id))
                        ? "Đang mặc"
                        : !outfit.items.every(id => owned.has(id))
                          ? "Chưa nhận đủ"
                          : "Mặc bộ"}
                    </button>
                  </div>
                ))}
              </details>

              <p className="studio-hint studio-wardrobe-note">
                Thử đồ luôn miễn phí, kể cả món khóa cấp. Mua bằng vàng trò chơi; trang phục không tăng chỉ số chiến đấu.
              </p>
            </>
          )}
        </div>
      </div>

      <footer className="studio-save-bar" aria-busy={busy} data-dirty={dirty}>
        <div className="studio-save-status">
          <span className="studio-save-icon" aria-hidden="true">
            {dirty ? <SlidersHorizontal size={19} /> : <Check size={19} />}
          </span>
          <div>
            <strong role="status">{busy ? "Đang xử lý…" : dirty ? "Có thay đổi chưa lưu" : "Ngoại hình đã đồng bộ"}</strong>
            <small>{preview ? "Trang phục đang thử chưa được trang bị. Lưu chỉ áp dụng ngoại hình." : "Lưu diện mạo để sử dụng trong thế giới của bạn."}</small>
          </div>
        </div>
        <div className="studio-save-actions">
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={() => {
              setDraft(null);
              setCompare(false);
            }}
          >
            <X size={15} aria-hidden="true" />
            Hủy
          </button>
          <button
            type="button"
            className="studio-primary"
            disabled={busy || !dirty || !current.name.trim()}
            onClick={save}
          >
            <Save size={15} aria-hidden="true" />
            Lưu ngoại hình
          </button>
        </div>
      </footer>
    </section>
  );
}
