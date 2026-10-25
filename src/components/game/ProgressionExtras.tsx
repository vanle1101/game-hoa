"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Archive, Check, Coins, FlaskConical, Gift, Heart, PackageOpen, Palette, PawPrint, Plus, Save, ShieldCheck, ShoppingBag, Sparkles, Zap } from "lucide-react";
import { CONSUMABLES, PET_ACCESSORIES } from "@/domain/catalog";
import type { Action, GameState } from "@/domain/types";
import "./reference-panels.css";

type Props = { state: GameState; act: (action: Action) => void; busy?: boolean };
const effectNames: Record<string, string> = { hp: "HP", energy: "NĂNG LƯỢNG", xp_boost: "TĂNG XP" };
function Button({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) { return <button className="btn primary" disabled={disabled} onClick={onClick}>{children}</button>; }
function GoldBalance({ gold }: { gold: number }) {
  return <span className="gold ref-extra-wallet"><Coins size={18} aria-hidden="true" /><span><small>VÀNG TRONG GAME</small><strong>{gold} G</strong></span></span>;
}

export function ConsumablesPanel({ state, act, busy }: Props) {
  return <section className="panel ref-extras ref-extras-consumables">
    <div className="section-heading ref-extras-header">
      <div><span className="eyebrow">TRẠM TIẾP TẾ · HỒI PHỤC & TĂNG CƯỜNG</span><h3>Vật phẩm tiêu hao</h3><p>Chuẩn bị năng lượng cho chặng hành trình tiếp theo.</p></div>
      <GoldBalance gold={state.gold} />
    </div>
    <div className="catalog-grid ref-extra-grid">{CONSUMABLES.map((item) => {
      const count = state.consumables?.[item.id] ?? 0;
      const full = item.effect === "hp" ? state.character.hp >= 100 : item.effect === "energy" ? state.character.energy >= 100 : false;
      const Icon = item.effect === "hp" ? Heart : item.effect === "energy" ? Zap : Sparkles;
      return <article className={`catalog-card ref-extra-card ref-extra-${item.effect}`} key={item.id}>
        <div className="ref-extra-icon"><Icon size={26} aria-hidden="true" /></div>
        <div className="ref-extra-body"><span className="eyebrow">{effectNames[item.effect] || item.effect.toUpperCase()}</span><h4>{item.name}</h4><p>{item.description}</p><span className="ref-extra-stock">Trong túi · <strong>{count}</strong></span></div>
        <div className="small-row ref-extra-actions"><span className="gold"><Coins size={15} aria-hidden="true" /> {item.price} G</span><Button disabled={busy || state.gold < item.price} onClick={() => act({ type: "consumable.buy", consumableId: item.id })}><ShoppingBag size={15} aria-hidden="true" /> Mua</Button><Button disabled={busy || count === 0 || full} onClick={() => act({ type: "consumable.consume", consumableId: item.id })}><FlaskConical size={15} aria-hidden="true" /> Dùng</Button></div>
        <p className="footnote ref-extra-hint">{full ? "Chỉ số đã đầy · chưa cần sử dụng." : count === 0 ? "Mua vật phẩm để bổ sung vào túi đồ." : "Vật phẩm đã sẵn sàng để sử dụng."}</p>
      </article>;
    })}</div>
  </section>;
}

export function PersonalRewardsPanel({ state, act, busy }: Props) {
  const [name, setName] = useState(""), [description, setDescription] = useState(""), [cost, setCost] = useState("50");
  const submit = (event: FormEvent) => { event.preventDefault(); const value = Number(cost); if (name.trim() && Number.isSafeInteger(value) && value > 0) { act({ type: "reward.create", name: name.trim(), description: description.trim(), cost: value }); setName(""); setDescription(""); } };
  return <section className="panel ref-extras ref-extras-rewards">
    <div className="section-heading ref-extras-header"><div><span className="eyebrow">PHẦN THƯỞNG ĐỜI THẬT</span><h3>Thưởng cho chính mình</h3><p>Biến nỗ lực mỗi ngày thành một điều đáng mong chờ.</p></div><GoldBalance gold={state.gold} /></div>
    <p className="footnote ref-extra-currency-note"><ShieldCheck size={16} aria-hidden="true" /> Đổi bằng vàng trong game (G), không phải VND. Phần thưởng ngoài đời do bạn tự thực hiện; đây không phải giao dịch tiền thật.</p>
    <form className="form-grid ref-reward-form" onSubmit={submit}>
      <div className="ref-reward-form-heading"><Gift size={20} aria-hidden="true" /><div><span className="eyebrow">THIẾT KẾ ĐỘNG LỰC</span><h4>Thêm điều bạn yêu thích</h4></div></div>
      <label>Tên phần thưởng<input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="Một buổi xem phim thật thư giãn" /></label>
      <label>Giá bằng vàng (G)<input type="number" min={1} step={1} value={cost} onChange={(e) => setCost(e.target.value)} /></label>
      <label className="ref-reward-description">Mô tả<textarea value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} placeholder="Khoảnh khắc bạn muốn dành cho bản thân…" /></label>
      <div className="ref-extra-actions"><Button disabled={busy || !name.trim()}><Plus size={16} aria-hidden="true" /> Tạo phần thưởng</Button></div>
    </form>
    {(state.realLifeRewards ?? []).length === 0 && <div className="ref-extra-empty"><Gift size={32} aria-hidden="true" /><h4>Một phần thưởng đang chờ được viết nên</h4><p>Thêm điều khiến bạn háo hức ở biểu mẫu phía trên. Vàng kiếm được trong game sẽ trở thành động lực cho hành trình của bạn.</p></div>}
    <div className="catalog-grid ref-extra-grid">{(state.realLifeRewards ?? []).map((reward) => <article className={`catalog-card ref-extra-card ${reward.archived ? "muted" : ""}`} key={reward.id}>
      <div className="ref-extra-icon"><Gift size={26} aria-hidden="true" /></div>
      <div className="ref-extra-body"><span className="eyebrow">{reward.redemptions} LẦN NHẬN {reward.archived ? "· ĐÃ LƯU TRỮ" : ""}</span><h4>{reward.name}</h4><p>{reward.description || "Một lời hẹn dành riêng cho chính bạn."}</p></div>
      <div className="small-row ref-extra-actions"><span className="gold"><Coins size={15} aria-hidden="true" /> {reward.cost} G</span>{!reward.archived && <><Button disabled={busy || state.gold < reward.cost} onClick={() => act({ type: "reward.redeem", rewardId: reward.id })}><Gift size={15} aria-hidden="true" /> Nhận</Button><Button disabled={busy} onClick={() => act({ type: "reward.archive", rewardId: reward.id })}><Archive size={15} aria-hidden="true" /> Lưu trữ</Button></>}</div>
    </article>)}</div>
  </section>;
}

export function AppearancePanel({ state, act, busy }: Props) {
  const [name, setName] = useState(state.character.name), [skin, setSkin] = useState(state.character.skin), [outfit, setOutfit] = useState(state.character.outfit), [hair, setHair] = useState(state.character.hair), [hairstyle, setHairstyle] = useState(state.character.hairstyle);
  return <section className="panel ref-extras ref-extras-appearance">
    <div className="section-heading ref-extras-header"><div><span className="eyebrow">TÙY CHỈNH NHÂN VẬT</span><h3>{state.character.name}</h3><p>Dấu ấn riêng của bạn giữa thành phố Neon Haven.</p></div><span className="ref-extra-icon"><Palette size={26} aria-hidden="true" /></span></div>
    <div className="form-grid ref-appearance-form"><label>Tên<input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label><label className="ref-extra-color">Màu da<span className="ref-extra-color-control"><input type="color" value={skin} onChange={(e) => setSkin(e.target.value)} /><span>{skin}</span></span></label><label className="ref-extra-color">Trang phục<span className="ref-extra-color-control"><input type="color" value={outfit} onChange={(e) => setOutfit(e.target.value)} /><span>{outfit}</span></span></label><label className="ref-extra-color">Màu tóc<span className="ref-extra-color-control"><input type="color" value={hair} onChange={(e) => setHair(e.target.value)} /><span>{hair}</span></span></label><label>Kiểu tóc<select value={hairstyle} onChange={(e) => setHairstyle(e.target.value as "short" | "swept" | "mohawk")}><option value="short">Ngắn</option><option value="swept">Vuốt lệch</option><option value="mohawk">Mào neon</option></select></label></div>
    <div className="ref-extra-actions"><Button disabled={busy || !name.trim()} onClick={() => act({ type: "character.update", name, skin, outfit, hair, hairstyle })}><Save size={16} aria-hidden="true" /> Lưu ngoại hình</Button></div>
  </section>;
}

export function PetExtras({ state, act, busy }: Props) {
  const active = state.activePetId;
  return <section className="panel ref-extras ref-extras-pets">
    <div className="section-heading ref-extras-header"><div><span className="eyebrow">THÚ CƯNG</span><h3>Thú cưng đồng hành</h3><p>Một người bạn nhỏ, cùng bạn qua những ngày lớn.</p></div><GoldBalance gold={state.gold} /></div>
    {state.pets.length === 0 && <div className="ref-extra-empty"><PawPrint size={32} aria-hidden="true" /><h4>Chưa có bạn đồng hành</h4><p>Khi sở hữu thú cưng, bạn có thể chọn đồng hành, chăm sóc và trang bị phụ kiện tại đây.</p></div>}
    <div className="catalog-grid ref-extra-grid">{state.pets.map((pet) => <article className={`catalog-card ref-extra-card ${pet.id === active ? "selected" : ""}`} key={pet.id}>
      <div className="ref-extra-icon"><PawPrint size={26} aria-hidden="true" /></div><div className="ref-extra-body"><span className="eyebrow">GẮN KẾT {pet.bond} · {pet.id === active ? "ĐANG ĐỒNG HÀNH" : ""}</span><h4>{pet.name}</h4></div>
      <div className="small-row ref-extra-actions"><Button disabled={busy || pet.id === active} onClick={() => act({ type: "pet.select", petId: pet.id })}>{pet.id === active ? <Check size={15} aria-hidden="true" /> : <PawPrint size={15} aria-hidden="true" />} Chọn</Button><Button disabled={busy} onClick={() => act({ type: "pet.care", petId: pet.id })}><Heart size={15} aria-hidden="true" /> Chăm sóc</Button></div>
      <div className="small-row ref-extra-actions ref-extra-accessories">{PET_ACCESSORIES.map((accessory) => <Button key={accessory.id} disabled={busy || !(state.ownedPetAccessories ?? []).includes(accessory.id)} onClick={() => act({ type: "pet.accessory.equip", petId: pet.id, accessoryId: accessory.id })}>{state.petAccessories?.[pet.id] === accessory.id ? "Đang đeo" : accessory.name}</Button>)}</div>
    </article>)}</div>
    <div className="ref-extras-header ref-extra-subheading"><div><span className="eyebrow">PHONG CÁCH ĐỒNG HÀNH</span><h4>Phụ kiện thú cưng</h4></div></div>
    <div className="catalog-grid ref-extra-grid">{PET_ACCESSORIES.map((accessory) => <article className="catalog-card ref-extra-card" key={accessory.id}><div className="ref-extra-icon"><PackageOpen size={26} aria-hidden="true" /></div><div className="ref-extra-body"><span className="eyebrow">MỸ PHẨM</span><h4>{accessory.name}</h4><p>{accessory.description}</p></div><div className="ref-extra-actions"><Button disabled={busy || (state.ownedPetAccessories ?? []).includes(accessory.id) || state.gold < accessory.price} onClick={() => act({ type: "pet.accessory.buy", accessoryId: accessory.id })}>{(state.ownedPetAccessories ?? []).includes(accessory.id) ? <Check size={15} aria-hidden="true" /> : <Coins size={15} aria-hidden="true" />}{(state.ownedPetAccessories ?? []).includes(accessory.id) ? "Đã sở hữu" : `Mua · ${accessory.price} G`}</Button></div></article>)}</div>
    <div className="ref-extra-actions">{state.pets.filter((pet) => state.petAccessories?.[pet.id]).map((pet) => <Button key={pet.id} disabled={busy} onClick={() => act({ type: "pet.accessory.remove", petId: pet.id })}>Tháo phụ kiện · {pet.name}</Button>)}</div>
    <p className="footnote ref-extra-currency-note"><ShieldCheck size={16} aria-hidden="true" /> Phụ kiện chỉ mang tính thẩm mỹ và không ảnh hưởng đến tài chính thật.</p>
  </section>;
}
