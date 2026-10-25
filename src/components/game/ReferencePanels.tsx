"use client";

import { useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, Boxes, Check, Coins, Crosshair, Gem, Heart, Lock, Search, Shield, Sparkles, Swords, Trophy, Zap } from "lucide-react";
import { BALANCE, ITEMS, MATERIALS, PETS, PET_ACCESSORIES, RECIPES, SKILL_NODES } from "@/domain/catalog";
import { levelProgress } from "@/domain/engine";
import { EquipmentArtwork } from "@/components/equipment/EquipmentArtwork";
import type { Action, EquipmentSlot, GameState, ItemDefinition, ItemInstance, Rarity, Skill } from "@/domain/types";
import "./reference-panels.css";
import "../equipment/equipment-shop.css";
import dynamic from "next/dynamic";
const PetShowcase=dynamic(()=>import("../world/PetShowcase"),{ssr:false});
const ItemShowcase=dynamic(()=>import("../world/ItemShowcase"),{ssr:false});

export type ReferencePanelProps = { state: GameState; act: (action: Action) => void; busy?: boolean; navigate: (screen: string) => void };
const rarityColor: Record<Rarity, string> = { common: "#a7bed1", uncommon: "#69dcb1", rare: "#32e6f4", epic: "#9067ff", legendary: "#ffbc62", mythic: "#ee5acb" };
const rarityNames: Record<Rarity, string> = { common: "Phổ thông", uncommon: "Khác thường", rare: "Hiếm", epic: "Sử thi", legendary: "Huyền thoại", mythic: "Thần thoại" };
const slotNames: Record<EquipmentSlot, string> = { weapon: "Vũ khí", head: "Đầu", chest: "Giáp", gloves: "Găng tay", boots: "Giày", accessory1: "Phụ kiện I", accessory2: "Phụ kiện II", relic: "Di vật" };
const skillNames: Record<Skill, string> = { health: "Sức khỏe", knowledge: "Tri thức", career: "Sự nghiệp", finance: "Tài chính", relationships: "Kết nối", creativity: "Sáng tạo" };
const tint = (rarity: Rarity): CSSProperties => ({ "--item-accent": rarityColor[rarity] } as CSSProperties);
const itemStats = (item: ItemDefinition, enhancement = 0) => ({ attack: Math.round(item.attack * (1 + enhancement * .1)), defense: Math.round(item.defense * (1 + enhancement * .1)), crit: Math.round(item.critRate * 100) });
function ActionButton({ children, onClick, disabled = false, secondary = false }: { children: ReactNode; onClick: () => void; disabled?: boolean; secondary?: boolean }) { return <button className={`ref-action ${secondary ? "secondary" : ""}`} onClick={onClick} disabled={disabled}>{children}</button>; }
function Empty({ children }: { children: ReactNode }) { return <div className="ref-empty" role="status"><span className="ref-empty-icon"><Boxes size={30} aria-hidden="true" /></span><strong>Hành trình vẫn còn phía trước</strong><p>{children}</p></div>; }
const panelDescriptions: Record<string, string> = {
 "Kho trang bị": "Chọn trang bị, so sánh chỉ số và sẵn sàng cho thử thách tiếp theo.",
 "Sàn giao dịch": "Khám phá công nghệ mới. Xem trước tự do, mua bằng Vàng trong game.",
 "Xưởng chế tạo": "Từ nguyên liệu tích lũy đến trang bị mang dấu ấn của bạn.",
 "Dấu ấn chiến thắng": "Mỗi chiến thắng là một bước tiến thật trên hành trình của bạn.",
 "Mạng lưới tiềm năng": "Sáu lĩnh vực cuộc sống. Mở tiềm năng từ những nhiệm vụ đã hoàn thành.",
 "Không đi một mình": "Gặp gỡ, chăm sóc và cùng người bạn nhỏ khám phá Neon Haven."
};
function Header({ title, detail, state }: { title: string; detail: string; state: GameState }) { return <header className="ref-header"><div className="ref-heading-copy"><span className="ref-kicker">NEON HAVEN / {detail}</span><h2>{title}</h2><p className="ref-subtitle">{panelDescriptions[title]}</p></div><div className="ref-wallet"><Coins size={22} aria-hidden="true"/><span><small>VÀNG TRONG GAME</small><strong>{state.gold.toLocaleString("vi-VN")} <em>G</em></strong></span></div></header>; }
function PanelSummary({ children }: { children: ReactNode }) { return <div className="ref-summary">{children}</div>; }

/** Original vector illustrations; these are item artwork, not imported 3D models. */
export function ItemArtwork({ item, large = false }: { item: ItemDefinition; large?: boolean }) {
 return <EquipmentArtwork item={item} large={large} />;
}
function Stats({ item, enhancement = 0, compare }: { item: ItemDefinition; enhancement?: number; compare?: { item: ItemDefinition; enhancement: number } }) {
 const stats=itemStats(item,enhancement), old=compare?itemStats(compare.item,compare.enhancement):null;
 return <dl className="ref-stats">{([['attack','Sức mạnh'],['defense','Phòng thủ'],['crit','Chí mạng']] as const).map(([key,label])=>
<div key={key}>
<dt>{key==='attack'?<Swords size={14} aria-hidden="true"/>:key==='defense'?<Shield size={14} aria-hidden="true"/>:<Crosshair size={14} aria-hidden="true"/>}{label}</dt>
<dd>{stats[key]}{key==='crit'?'%':''}{old&&<small className={stats[key]>=old[key]?'positive':'negative'}>{stats[key]-old[key]>=0?'+':''}{stats[key]-old[key]}{key==='crit'?'%':''}</small>}</dd>
</div>)}</dl>;
}
function Inspector({ item, instance, state, children }: { item: ItemDefinition; instance?: ItemInstance; state: GameState; children: ReactNode }) {
 const equipped=state.inventory.find(i=>i.id===state.equipment[item.slot]), compare=equipped&&ITEMS.find(d=>d.id===equipped.definitionId);
 return <section className="ref-inspector" style={tint(item.rarity)}>
<div className="ref-showcase">
<span className="ref-kicker">{rarityNames[item.rarity]} / {slotNames[item.slot]}</span>
<ItemShowcase item={item}/>
<span className="ref-art-caption">XEM TRƯỚC 3D · KÉO ĐỂ XOAY</span>
</div>
<div className="ref-inspector-body">
<span className="ref-kicker">CẤP {item.level}{instance?` / NÂNG CẤP +${instance.enhancement}`:''}</span>
<h3>{item.name}</h3>
<p>{item.description}</p>
<Stats item={item} enhancement={instance?.enhancement} compare={compare&&equipped?{item:compare,enhancement:equipped.enhancement}:undefined}/>{compare&&<p className="ref-note">Chênh lệch so với {compare.name} đang trang bị ở ô {slotNames[item.slot]}.</p>}<div className="ref-actions">{children}</div>
</div>
</section>;
}
const categories=[['all','Tất cả'],['weapon','Vũ khí'],['armor','Giáp & bảo hộ'],['accessory','Phụ kiện'],['relic','Di vật']] as const;
function categoryMatch(item:ItemDefinition, category:string){return category==='all'||item.slot===category||(category==='armor'&&['head','chest','gloves','boots'].includes(item.slot))||(category==='accessory'&&item.slot.startsWith('accessory'));}
function Categories({value,onChange}:{value:string;onChange:(value:string)=>void}) {return <div className="ref-categories" aria-label="Nhóm vật phẩm">{categories.map(([id,label])=>
<button key={id} aria-pressed={value===id} onClick={()=>onChange(id)}>{label}</button>)}</div>;}

export function ReferenceInventory({state,act,busy,navigate}:ReferencePanelProps){
 const [selected,setSelected]=useState(state.inventory[0]?.id||''),[category,setCategory]=useState('all'),[search,setSearch]=useState(''),[rarity,setRarity]=useState('all');
 const filtered=state.inventory.filter(i=>{const d=ITEMS.find(d=>d.id===i.definitionId);return d&&categoryMatch(d,category)&&d.name.toLowerCase().includes(search.toLowerCase())&&(rarity==='all'||d.rarity===rarity);});
 const instance=filtered.find(i=>i.id===selected)||filtered[0], item=ITEMS.find(d=>d.id===instance?.definitionId); const worn=instance?Object.entries(state.equipment).find(([,id])=>id===instance.id):undefined;
 return <div className="ref-panel">
<Header title="Kho trang bị" detail="KHO VŨ KHÍ CÁ NHÂN" state={state}/>
<PanelSummary><span><Boxes size={16} aria-hidden="true"/><b>{state.inventory.length}</b> trang bị sở hữu</span><span><Shield size={16} aria-hidden="true"/><b>{Object.values(state.equipment).filter(Boolean).length}</b> ô đang sử dụng</span><span><Zap size={16} aria-hidden="true"/>Cấp {levelProgress(state.character.xp).level}</span></PanelSummary>
<Categories value={category} onChange={setCategory}/>
<div className="ref-split">
<section className="ref-collection">
<div className="ref-filters">
<label>
<Search size={15}/>
<input aria-label="Tìm vật phẩm" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm trong túi đồ…"/>
</label>
<select aria-label="Độ hiếm" value={rarity} onChange={e=>setRarity(e.target.value)}>
<option value="all">Mọi độ hiếm</option>{Object.keys(rarityColor).map(r=>
<option key={r} value={r}>{rarityNames[r as Rarity]}</option>)}</select>
</div>
<div className="ref-collection-heading"><span className="ref-kicker">LƯU TRỮ KHO VŨ KHÍ</span><span role="status">{filtered.length} kết quả</span></div>
<div className="ref-slots">{filtered.map(i=>{const d=ITEMS.find(d=>d.id===i.definitionId)!;return <button className={`ref-slot ${instance?.id===i.id?'selected':''}`} style={tint(d.rarity)} key={i.id} onClick={()=>setSelected(i.id)} aria-pressed={instance?.id===i.id}>
<ItemArtwork item={d}/>
<span className="ref-rarity-label">{rarityNames[d.rarity]}</span><strong>{d.name}</strong>
<small>+{i.enhancement} · CẤP {d.level}</small>{levelProgress(state.character.xp).level<d.level&&<span className="ref-locked-label"><Lock size={12} aria-hidden="true"/> Yêu cầu cấp {d.level}</span>}{Object.values(state.equipment).includes(i.id)&&<span className="ref-owned">
<Check size={12}/> Đang dùng</span>}</button>;})}</div>{!filtered.length&&<Empty>Không có vật phẩm phù hợp. Thay bộ lọc hoặc khám phá cửa hàng.</Empty>}<div className="ref-materials">
<span className="ref-kicker">KHO NGUYÊN LIỆU</span>{MATERIALS.map(m=>
<div key={m.id}>
<span className="ref-crystal" style={tint(m.rarity)}><Gem size={18} aria-hidden="true"/></span>
<span>{m.name}</span>
<b>{state.materials[m.id]||0}</b>
</div>)}</div>
</section>{item&&instance?<Inspector item={item} instance={instance} state={state}>
<ActionButton disabled={busy||levelProgress(state.character.xp).level<item.level} onClick={()=>act(worn?{type:'item.unequip',slot:worn[0] as EquipmentSlot}:{type:'item.equip',itemId:instance.id})}>{worn?'Tháo trang bị':'Trang bị'} <Shield size={15}/>
</ActionButton>
<ActionButton secondary onClick={()=>navigate('equipment')}>Hồ sơ trang bị</ActionButton>
<ActionButton secondary onClick={()=>navigate('crafting')}>Nâng cấp <ArrowRight size={15}/>
</ActionButton>
</Inspector>:<Empty>Chọn một vật phẩm để xem chi tiết.</Empty>}</div>
</div>;
}

export function ReferenceShop({ state, act, busy, navigate }: ReferencePanelProps) {
 const [category, setCategory] = useState('all');
 const [selected, setSelected] = useState('cyber-katana');
 const [confirm, setConfirm] = useState<string | null>(null);
 const [search, setSearch] = useState('');
 const [rarity, setRarity] = useState('all');
 const [ownership, setOwnership] = useState('all');
 const [level, setLevel] = useState('all');
 const [page, setPage] = useState(1);
 const previewRef = useRef<HTMLElement | null>(null);
 const pageSize = 12;
 const playerLevel = levelProgress(state.character.xp).level;
 const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim();
 const query = normalize(search);
 const ownedCounts = new Map<string, number>();
 state.inventory.forEach(instance => ownedCounts.set(instance.definitionId, (ownedCounts.get(instance.definitionId) || 0) + 1));
 const catalog = ITEMS.filter(entry => entry.price > 0);
 const list = catalog.filter(entry =>
  categoryMatch(entry, category) &&
  normalize(`${entry.name} ${entry.id}`).includes(query) &&
  (rarity === 'all' || entry.rarity === rarity) &&
  (ownership === 'all' || (ownership === 'owned' ? ownedCounts.has(entry.id) : !ownedCounts.has(entry.id))) &&
  (level === 'all' || (level === 'available' ? entry.level <= playerLevel : entry.level > playerLevel))
 );
 const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
 const currentPage = Math.min(page, pageCount);
 const start = (currentPage - 1) * pageSize;
 const visible = list.slice(start, start + pageSize);
 const item = catalog.find(entry => entry.id === selected) || catalog[0];
 const locked = !!item && playerLevel < item.level;
 const canBuy = !!item && !locked && state.gold >= item.price;
 const prefersReducedMotion = Boolean(state.settings?.reducedMotion) || (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const scrollToPreview = () => {
  const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';
  const target = previewRef.current || (typeof document !== 'undefined' ? document.querySelector<HTMLElement>('.equipment-shop-preview') : null);
  if (target && typeof target.scrollIntoView === 'function') {
   target.scrollIntoView({ behavior, block: 'start' });
   if (typeof target.focus === 'function') target.focus({ preventScroll: true });
  }
 };
 const changeFilter = (setValue: (value: string) => void, value: string) => {
  setValue(value);
  setPage(1);
  setConfirm(null);
 };
 const changePage = (next: number) => {
  setPage(Math.max(1, Math.min(next, pageCount)));
  setConfirm(null);
 };
 const resetFilters = () => {
  setCategory('all'); setSearch(''); setRarity('all'); setOwnership('all'); setLevel('all'); setPage(1); setConfirm(null);
 };
 const hasFilters = category !== 'all' || search !== '' || rarity !== 'all' || ownership !== 'all' || level !== 'all';
 return <div className="ref-panel equipment-shop">
  <Header title="Sàn giao dịch" detail="CHỢ TRANG BỊ" state={state}/>
  <nav className="ref-destinations" aria-label="Danh mục cửa hàng">
<button className="active" aria-current="page">Trang bị</button>
<button onClick={() => navigate('character')}>Thời trang</button>
<button onClick={() => navigate('furniture')}>Nội thất</button>
<button onClick={() => navigate('pets')}>Bạn đồng hành</button>
</nav>
  <div className="equipment-shop-layout">
   {item && <aside ref={previewRef} tabIndex={-1} className="equipment-shop-preview" aria-label="Chi tiết trang bị đang chọn">
    <div className="equipment-shop-preview-heading">
<span className="ref-kicker">XEM TRƯỚC MIỄN PHÍ</span>
<p>{visible.some(entry => entry.id === item.id) ? 'Chọn thẻ để xem mô hình và chỉ số.' : 'Giữ trang bị đã chọn khi bạn tìm kiếm hoặc chuyển trang.'}</p>
</div>
    <Inspector item={item} state={state}>
     <p className="ref-note">Sở hữu {ownedCounts.get(item.id) || 0} · ID: {item.id}</p>
     <div className="ref-price">
<span>{item.price} G</span>
<small>{locked ? `Yêu cầu cấp ${item.level} (hiện cấp ${playerLevel})` : state.gold < item.price ? `Còn thiếu ${item.price - state.gold} G` : `Sau khi mua: ${state.gold - item.price} G`}</small>
</div>
     {confirm === item.id ? <div className="ref-confirm" role="group" aria-label="Xác nhận mua">
<p>Mua {item.name} với {item.price} Vàng?</p>
<ActionButton disabled={busy || !canBuy} onClick={() => { if (busy || !canBuy || confirm !== item.id) return; act({ type: 'item.buy', definitionId: item.id }); setConfirm(null); }}>Xác nhận mua</ActionButton>
<ActionButton secondary disabled={busy} onClick={() => setConfirm(null)}>Hủy</ActionButton>
</div> : <ActionButton disabled={busy || !canBuy} onClick={() => { if (!busy && canBuy) setConfirm(item.id); }}>Mua trang bị <ArrowRight size={16}/>
</ActionButton>}
     {locked && <p className="ref-note">Yêu cầu đạt cấp {item.level} để mua trang bị này; bạn vẫn có thể xem trước mô hình 3D miễn phí.</p>}
     <ActionButton secondary onClick={() => navigate('inventory')}>Mở túi đồ</ActionButton>
    </Inspector>
   </aside>}
   <section className="ref-collection" aria-label="Danh sách trang bị">
  <Categories value={category} onChange={value => changeFilter(setCategory, value)}/>
  <div className="equipment-shop-filters" role="search" aria-label="Lọc cửa hàng trang bị">
   <label className="equipment-shop-search">
<span>Tìm trang bị</span>
<div>
<Search size={16} aria-hidden="true"/>
<input type="search" value={search} onChange={event => changeFilter(setSearch, event.target.value)} placeholder="Tên có dấu, không dấu hoặc ID…"/>
</div>
</label>
   <label>
<span>Độ hiếm</span>
<select value={rarity} onChange={event => changeFilter(setRarity, event.target.value)}>
<option value="all">Mọi độ hiếm</option>{Object.keys(rarityNames).map(value => <option key={value} value={value}>{rarityNames[value as Rarity]}</option>)}</select>
</label>
   <label>
<span>Sở hữu</span>
<select value={ownership} onChange={event => changeFilter(setOwnership, event.target.value)}>
<option value="all">Tất cả trang bị</option>
<option value="owned">Đã sở hữu</option>
<option value="unowned">Chưa sở hữu</option>
</select>
</label>
   <label>
<span>Cấp yêu cầu</span>
<select value={level} onChange={event => changeFilter(setLevel, event.target.value)}>
<option value="all">Mọi cấp</option>
<option value="available">Đủ cấp sử dụng</option>
<option value="locked">Chưa đủ cấp</option>
</select>
</label>
   <button className="equipment-shop-reset" disabled={!hasFilters} onClick={resetFilters}>Xóa bộ lọc</button>
  </div>
    <div className="equipment-shop-results">
<p role="status" aria-live="polite">{list.length ? `${start + 1}–${Math.min(start + pageSize, list.length)} / ${list.length} trang bị` : '0 trang bị phù hợp'}</p>
<span>Cấp của bạn: {playerLevel}</span>
</div>
    <nav className="equipment-shop-pagination" aria-label="Phân trang trang bị">
<button disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>Trang trước</button>
<span>Trang {currentPage} / {pageCount}</span>
<button disabled={currentPage === pageCount} onClick={() => changePage(currentPage + 1)}>Trang sau</button>
</nav>
    <div className="ref-slots">{visible.map(entry => <button key={entry.id} data-shop-item-id={entry.id} style={tint(entry.rarity)} className={`ref-slot ${item?.id === entry.id ? 'selected' : ''}`} aria-pressed={item?.id === entry.id} onClick={() => { setSelected(entry.id); setConfirm(null); }}>
<ItemArtwork item={entry}/>
<strong>{entry.name}</strong>
<small>{entry.price} G · CẤP {entry.level}</small>
<span className="equipment-shop-rarity">{rarityNames[entry.rarity]}</span>
<span className="ref-owned">Sở hữu {ownedCounts.get(entry.id) || 0}</span>{entry.level > playerLevel && <span className="equipment-shop-lock">
<Lock size={11} aria-hidden="true"/> Chưa đủ cấp</span>}</button>)}</div>
    {!list.length && <Empty>Không có trang bị phù hợp. Thử tên không dấu, ID hoặc xóa bộ lọc.</Empty>}
    <p className="ref-note equipment-shop-disclaimer">Vàng là tiền trong game. Mỗi giao dịch mua thêm một bản trang bị vào túi đồ. Chọn thẻ chỉ xem trước, không mua hay trang bị.</p>
    {item && <div className="equipment-shop-mobile-bar" role="region" aria-label="Trang bị đang chọn" data-selected-item-id={item.id} style={tint(item.rarity)}>
     <div className="equipment-shop-mobile-summary" aria-live="polite">
      <span className="ref-kicker">ĐANG CHỌN · {rarityNames[item.rarity]}</span>
      <strong>{item.name}</strong>
      <small>{item.price} G · CẤP {item.level}</small>
     </div>
     <button type="button" className="equipment-shop-mobile-jump" onClick={scrollToPreview}>Xem mô hình đã chọn</button>
    </div>}
   </section>
  </div>
 </div>;
}

export function ReferenceCrafting({state,act,busy}:ReferencePanelProps){
 const [mode,setMode]=useState<'craft'|'upgrade'>('craft'),[selection,setSelection]=useState('craft-katana'),[confirmed,setConfirmed]=useState(false);const recipe=RECIPES.find(r=>r.id===selection)||RECIPES[0],instance=state.inventory.find(i=>i.id===selection)||state.inventory[0];const item=ITEMS.find(i=>i.id===(mode==='craft'?recipe.itemId:instance?.definitionId));const next=(instance?.enhancement||0)+1,cost=mode==='craft'?recipe.gold:25*next,materials:Record<string,number>=mode==='craft'?recipe.materials:{alloy:2*next,'upgrade-component':next};const capped=mode==='upgrade'&&!!instance&&instance.enhancement>=BALANCE.maxEnhancement;const allowed=!!item&&!capped&&state.gold>=cost&&Object.entries(materials).every(([id,count])=>(state.materials[id]||0)>=count);
 return <div className="ref-panel ref-workshop">
<Header title="Xưởng chế tạo" detail="CHẾ TÁC CÔNG NGHỆ" state={state}/>
<div className="ref-categories" aria-label="Chế độ xưởng">
<button aria-pressed={mode==='craft'} onClick={()=>{setMode('craft');setConfirmed(false);}}>Chế tạo</button>
<button aria-pressed={mode==='upgrade'} onClick={()=>{setMode('upgrade');setConfirmed(false);}}>Nâng cấp</button>
</div>
<div className="ref-forge-layout">
<aside className="ref-recipe-list"><span className="ref-kicker">{mode==='craft'?'BẢN VẼ CHẾ TẠO':'TRANG BỊ SỞ HỮU'}</span>{mode==='craft'?RECIPES.map(r=>
<button key={r.id} aria-pressed={recipe.id===r.id} onClick={()=>{setSelection(r.id);setConfirmed(false);}}>
<ItemArtwork item={ITEMS.find(i=>i.id===r.itemId)!}/>
<span>
<strong>{r.name}</strong>
<small>{r.gold} G</small>
</span>
</button>):state.inventory.map(i=>
<button key={i.id} aria-pressed={instance?.id===i.id} onClick={()=>{setSelection(i.id);setConfirmed(false);}}>
<ItemArtwork item={ITEMS.find(d=>d.id===i.definitionId)!}/>
<span>
<strong>{ITEMS.find(d=>d.id===i.definitionId)?.name}</strong>
<small>Hiện tại +{i.enhancement}</small>
</span>
</button>)}</aside>{item?<section className="ref-forge-main" style={tint(item.rarity)}>
<div className="ref-showcase">
<span className="ref-kicker">{mode==='craft'?'BẢN VẼ SẴN SÀNG':`NÂNG CẤP +${instance?.enhancement} → +${next}`}</span>
<ItemShowcase item={item}/>
<div className="ref-pedestal"/>
</div>
<div className="ref-forge-details"><span className="ref-kicker">{rarityNames[item.rarity]} / {slotNames[item.slot]}</span>
<h3>{item.name}</h3><p className="ref-note">{mode==='craft'?'Chỉ số trang bị sau khi chế tạo.':'Chỉ số sau nâng cấp · so sánh với hiện tại.'}</p>
<Stats item={item} enhancement={mode==='upgrade'?next:0} compare={mode==='upgrade'&&instance?{item,enhancement:instance.enhancement}:undefined}/>
<div className="ref-materials"><span className="ref-kicker">TÀI NGUYÊN · ĐANG CÓ / CẦN DÙNG</span>{Object.entries(materials).map(([id,count])=>
<div key={id} className={(state.materials[id]||0)<count?'negative':''}>
<span className="ref-crystal"><Gem size={18} aria-hidden="true"/></span>
<span>{MATERIALS.find(m=>m.id===id)?.name||id}</span>
<b>{state.materials[id]||0} / {count}</b>
</div>)}<div>
<span>Vàng</span>
<b>{state.gold} / {cost}</b>
</div>
</div>{capped?<p>Đã đạt cấp nâng tối đa +{BALANCE.maxEnhancement}.</p>:confirmed?<div className="ref-confirm" role="group" aria-label="Xác nhận chế tạo">
<p>Xác nhận dùng {cost} Vàng và nguyên liệu bên trên?</p>
<ActionButton disabled={busy||!allowed} onClick={()=>{act(mode==='craft'?{type:'item.craft',recipeId:recipe.id}:{type:'item.upgrade',itemId:instance!.id});setConfirmed(false);}}>Xác nhận {mode==='craft'?'chế tạo':'nâng cấp'}</ActionButton>
<ActionButton secondary onClick={()=>setConfirmed(false)}>Hủy</ActionButton>
</div>:<ActionButton disabled={busy||!allowed} onClick={()=>setConfirmed(true)}>{allowed?(mode==='craft'?'Chế tạo trang bị':'Nâng cấp trang bị'):'Chưa đủ tài nguyên'} <Zap size={16}/>
</ActionButton>}<p className="ref-note">Nâng cấp tất định. Vật phẩm và tài nguyên được cập nhật cùng một giao dịch.</p>
</div>
</section>:<Empty>Bạn chưa có trang bị để nâng cấp.</Empty>}</div>
</div>;
}

export function ReferenceLoot({state,act,busy,navigate}:ReferencePanelProps){
 const events=state.journal.filter(e=>['boss.defeated','boss.meaningful.defeated'].includes(e.type)).slice().reverse(); const [selected,setSelected]=useState('');const event=events.find(e=>e.id===selected)||events[0];const ids=event&&Array.isArray(event.data.items)?event.data.items:[];const instances=state.inventory.filter(i=>ids.includes(i.id));const [itemId,setItemId]=useState('');const instance=instances.find(i=>i.id===itemId)||instances[0], item=ITEMS.find(d=>d.id===instance?.definitionId);
 return <div className="ref-panel">
<Header title="Dấu ấn chiến thắng" detail="PHẦN THƯỞNG ĐẠT ĐƯỢC" state={state}/>{event?<>
<PanelSummary><span><Trophy size={16} aria-hidden="true"/><b>{events.length}</b> chiến thắng đã ghi nhận</span><span><Check size={16} aria-hidden="true"/>Phần thưởng đã vào tài khoản</span></PanelSummary><div className="ref-loot-layout">
<aside className="ref-history">
<span className="ref-kicker">LỊCH SỬ CHIẾN THẮNG</span>{events.map(e=>
<button key={e.id} aria-pressed={e.id===event.id} onClick={()=>{setSelected(e.id);setItemId('');}}>
<strong>{e.title}</strong>
<small>{new Date(e.at).toLocaleDateString('vi-VN')}</small>
</button>)}</aside>
<section className="ref-loot-reveal" style={tint(item?.rarity||'legendary')}>
<span className="ref-kicker"><Trophy size={16} aria-hidden="true"/> HOÀN THÀNH TRẬN ĐẤU</span>
<h3>{event.title}</h3>{item?<ItemShowcase item={item}/>:<div className="ref-loot-emblem">
<Sparkles size={100}/>
</div>}<h2>{item?.name||'Một cột mốc mới'}</h2>
<div className="ref-rewards">
<div>
<b>+{Number(event.data.xp)||0}</b>
<span>XP</span>
</div>
<div>
<b>+{Number(event.data.gold)||0}</b>
<span>VÀNG</span>
</div>
<div>
<b>{instances.length}</b>
<span>TRANG BỊ</span>
</div>
</div>
<div className="ref-actions">{instance&&item&&<ActionButton disabled={busy||Object.values(state.equipment).includes(instance.id)||levelProgress(state.character.xp).level<item.level} onClick={()=>act({type:'item.equip',itemId:instance.id})}>{Object.values(state.equipment).includes(instance.id)?'Đang trang bị':'Trang bị ngay'}</ActionButton>}<ActionButton secondary onClick={()=>navigate('inventory')}>Mở túi đồ <ArrowRight size={16}/>
</ActionButton>
</div>
<p className="ref-note">Phần thưởng đã được ghi nhận. Mở lại màn hình không cấp thêm phần thưởng.</p>{instances.length>1&&<div className="ref-slots">{instances.map(i=>
<button className={`ref-slot ${instance?.id===i.id?'selected':''}`} style={tint(ITEMS.find(d=>d.id===i.definitionId)!.rarity)} aria-pressed={instance?.id===i.id} key={i.id} onClick={()=>setItemId(i.id)}>
<ItemArtwork item={ITEMS.find(d=>d.id===i.definitionId)!}/><strong>{ITEMS.find(d=>d.id===i.definitionId)?.name}</strong>
</button>)}</div>}</section>
</div>
</>:<Empty>Hoàn thành một thử thách trùm để lưu chiến thắng đầu tiên. Tiến độ đến từ việc bạn thực sự hoàn thành.</Empty>}</div>;
}

const branches=Object.keys(skillNames) as Skill[];
const branchPoints=[[360,110],[580,175],[580,385],[360,450],[140,385],[140,175]];
export function ReferenceSkills({state,act,busy,navigate}:ReferencePanelProps){
 const [selected,setSelected]=useState(SKILL_NODES[0].id),node=SKILL_NODES.find(n=>n.id===selected)||SKILL_NODES[0];const owned=state.character.skillNodes.includes(node.id),prereq=!node.prerequisite||state.character.skillNodes.includes(node.prerequisite),xp=state.character.skillXp[node.skill],canUnlock=!owned&&prereq&&xp>=node.requiredXp;
 return <div className="ref-panel">
<Header title="Mạng lưới tiềm năng" detail="SÁU NHÁNH / MỘT HÀNH TRÌNH" state={state}/>
<PanelSummary><span><Check size={16} aria-hidden="true"/><b>{state.character.skillNodes.length}</b> kỹ năng đã mở</span><span><Sparkles size={16} aria-hidden="true"/>Sẵn sàng mở</span><span><Lock size={16} aria-hidden="true"/>Cần thêm điều kiện</span></PanelSummary><div className="ref-skill-layout">
<div className="ref-skill-map">
<svg viewBox="0 0 720 560" preserveAspectRatio="none" aria-hidden="true">
<defs>
<radialGradient id="ref-skill-halo">
<stop stopColor="#9067ff" stopOpacity=".28"/>
<stop offset="1" stopColor="#080d18" stopOpacity="0"/>
</radialGradient>
</defs>
<circle cx="360" cy="280" r="230" fill="url(#ref-skill-halo)"/>
<circle cx="360" cy="280" r="171" fill="none" stroke="#283956" strokeDasharray="4 11"/>{branchPoints.map(([x,y],i)=>
<path key={i} d={`M360 280 L${x} ${y}`} stroke={state.character.skillNodes.some(id=>SKILL_NODES.find(n=>n.id===id)?.skill===branches[i])?'#32e6f4':'#3b4262'} strokeWidth="2"/>)}<path d="M360 240 395 260 395 300 360 320 325 300 325 260Z" fill="#192541" stroke="#9067ff" strokeWidth="2"/>
<text x="360" y="285" fill="#edf4ff" textAnchor="middle" fontSize="13">LIFE</text>
</svg>{branches.map((skill,i)=>
<div className="ref-skill-branch" key={skill} style={{left:`${branchPoints[i][0]/7.2}%`,top:`${branchPoints[i][1]/5.6}%`}}>
<span>{skillNames[skill]}<small>{state.character.skillXp[skill]} XP</small></span>{SKILL_NODES.filter(n=>n.skill===skill).map(n=>{const isOwned=state.character.skillNodes.includes(n.id),isReady=!isOwned&&(!n.prerequisite||state.character.skillNodes.includes(n.prerequisite))&&state.character.skillXp[n.skill]>=n.requiredXp;return <button key={n.id} aria-pressed={n.id===node.id} aria-label={`${n.name}, ${isOwned?'đã mở':isReady?'sẵn sàng mở':'chưa đủ điều kiện'}`} className={`${isOwned?'unlocked':isReady?'available':'locked'} ${n.id===node.id?'selected':''}`} onClick={()=>setSelected(n.id)}>{isOwned?<Check size={18}/>:isReady?<Sparkles size={18}/>:<Lock size={16}/>}<small>{n.name}</small><span className="ref-node-status">{isOwned?'Đã mở':isReady?'Sẵn sàng':`${n.requiredXp} XP`}</span></button>;})}</div>)}</div>
<aside className="ref-skill-detail">
<span className="ref-kicker">{skillNames[node.skill]} / {owned?'ĐÃ MỞ':'TIỀM NĂNG'}</span>
<h3>{node.name}</h3>
<div className="ref-skill-icon">
<Sparkles size={52}/>
</div>
<dl className="ref-stats">
<div>
<dt>Sức mạnh</dt>
<dd>+{node.attack}</dd>
</div>
<div>
<dt>Phòng thủ</dt>
<dd>+{node.defense}</dd>
</div>
</dl>
<p>{xp} / {node.requiredXp} XP {skillNames[node.skill]}</p>
<progress aria-label={`Tiến độ ${node.name}`} value={Math.min(xp,node.requiredXp)} max={node.requiredXp}/>{node.prerequisite&&<p className="ref-note">Yêu cầu: {SKILL_NODES.find(n=>n.id===node.prerequisite)?.name} {prereq?'✓':''}</p>}<ActionButton disabled={busy||!canUnlock} onClick={()=>act({type:'skill.unlock',nodeId:node.id})}>{owned?'Đã mở kỹ năng':canUnlock?'Mở kỹ năng':'Chưa đủ điều kiện'}</ActionButton>
<ActionButton secondary onClick={()=>navigate('quests')}>Tích lũy từ nhiệm vụ</ActionButton>
</aside>
</div>
</div>;
}

function PetArtwork({id,color,accessory}:{id:string;color:string;accessory?:string}) {const uid=useId().replace(/:/g,'');return <svg viewBox="0 0 420 320" role="img" aria-label={PETS.find(p=>p.id===id)?.name||'Bạn đồng hành'} className="ref-pet-art">
<defs>
<linearGradient id={uid} x1="0" x2="1" y2="1">
<stop stopColor="#9db2c9"/>
<stop offset=".4" stopColor="#31465e"/>
<stop offset="1" stopColor="#122238"/>
</linearGradient>
</defs>
<ellipse cx="210" cy="286" rx="100" ry="14" fill="#050b14"/>
<ellipse cx="210" cy="287" rx="108" ry="16" fill="none" stroke={color} opacity=".5"/>
<g fill={`url(#${uid})`} stroke="#7f9ab0" strokeWidth="2">{id==='drone'?<>
<ellipse cx="210" cy="153" rx="84" ry="64"/>
<path d="M124 154 90 171 78 200 135 187M296 154 330 171 342 200 285 187"/>
<ellipse cx="210" cy="192" rx="47" ry="17" fill="#091b2d"/>
<path d="M178 94 210 57 242 94"/>
<path d="M145 127 275 127 283 162 260 184 161 184 138 161Z" fill="#0b192b"/>
<path d="M178 145v18M241 145v18" stroke={color} strokeWidth="13" strokeLinecap="round"/>
<ellipse cx="210" cy="207" rx="25" ry="5" fill={color}/>
</>:<>
<path d={id==='fox'?'M267 235 Q368 222 351 116 Q316 178 276 175 L248 219Z':'M267 238 Q345 231 320 168 Q303 145 300 174 Q326 215 270 208Z'}/>
<path d="M150 203 160 154 251 153 274 228 253 264 170 261Z"/>
<path d="M156 215 147 275 176 281 195 231M234 227 241 280 276 276 267 214"/>
<path d="M146 136 134 57 183 92M235 94 286 53 272 142"/>
<path d="M147 118 145 77 169 102M249 108 274 76 268 122" fill={color} opacity=".6"/>
<path d="M146 111 183 89 234 89 272 116 280 160 252 198 211 211 168 196 140 160Z"/>
<path d="M158 134 197 127 210 143 227 127 264 134 258 159 227 174 210 168 192 176 160 160Z" fill="#0a1929"/>
<ellipse cx="181" cy="150" rx="10" ry="14" fill={color}/>
<ellipse cx="241" cy="150" rx="10" ry="14" fill={color}/>
<path d="M200 181 220 181 210 192Z" fill={color}/>
<path d="M174 211 210 225 251 209" fill="none" stroke={color} strokeWidth="5"/>
<circle cx="210" cy="231" r="7" fill={color}/>
<path d="M153 259 174 263M245 264 271 259" stroke={color} strokeWidth="3"/>
</>}</g>{accessory&&<ellipse cx="210" cy={id==='drone'?72:215} rx={id==='drone'?65:48} ry="11" fill="none" stroke={accessory} strokeWidth="4"/>}</svg>;}
export function ReferencePets({state,act,busy,navigate}:ReferencePanelProps){
 const [selected,setSelected]=useState(state.activePetId||PETS[0].id),[confirm,setConfirm]=useState(false);const pet=PETS.find(p=>p.id===selected)||PETS[0],owned=state.pets.find(p=>p.id===pet.id),today=new Intl.DateTimeFormat('en-CA',{timeZone:state.settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return <div className="ref-panel">
<Header title="Không đi một mình" detail="MẠNG LƯỚI ĐỒNG HÀNH" state={state}/><PanelSummary><span><Heart size={16} aria-hidden="true"/><b>{state.pets.length}</b> người bạn đã đón về</span><span><Sparkles size={16} aria-hidden="true"/>Chăm sóc mỗi ngày để tăng gắn kết</span></PanelSummary>
<div className="ref-pets-layout">
<section className="ref-pet-stage">
<span className="ref-kicker">{owned?'BẠN ĐỒNG HÀNH CỦA BẠN':'GẶP GỠ BẠN ĐỒNG HÀNH'}</span>
<PetShowcase id={pet.id} quality={state.settings.graphics} reducedMotion={state.settings.reducedMotion} accessoryColor={PET_ACCESSORIES.find(a=>a.id===state.petAccessories?.[pet.id])?.color}/>
<h2>{owned?.name||pet.name}</h2>
<p>{pet.id==='neko'?'Một tín hiệu ấm áp trong những ngày bận rộn.':pet.id==='fox'?'Nhẹ bước qua thành phố, luôn ở bên bạn.':'Người bạn nhỏ trên quỹ đạo cuộc sống.'}</p>
<div className="ref-pet-choices">{PETS.map(p=>
<button key={p.id} aria-pressed={pet.id===p.id} onClick={()=>{setSelected(p.id);setConfirm(false);}}>
<PetArtwork id={p.id} color={p.color}/>
<strong>{p.name}</strong>
<small>{state.activePetId===p.id?'Đang đồng hành':state.pets.some(v=>v.id===p.id)?'Đã đón về':`${p.price} G`}</small>
</button>)}</div>
</section>
<aside className="ref-pet-detail">
<span className="ref-kicker">{owned?'GẮN KẾT & CHĂM SÓC':'NHẬN NUÔI'}</span>{owned?<>
<span className="ref-pet-bond"><Heart size={22} aria-hidden="true"/><strong>{owned.bond}<small>%</small></strong></span><h3>Gắn kết cùng {owned.name||pet.name}</h3>
<progress aria-label={`Gắn kết ${owned.name||pet.name}`} value={owned.bond} max={100}/>
<p>Một chút quan tâm mỗi ngày. Chăm sóc tăng gắn kết với bạn đồng hành.</p>
<ActionButton disabled={busy||owned.lastCareDate===today} onClick={()=>act({type:'pet.care',petId:pet.id})}>{owned.lastCareDate===today?'Đã chăm sóc hôm nay':'Dành thời gian chăm sóc'}</ActionButton>
<ActionButton secondary disabled={busy||state.activePetId===pet.id} onClick={()=>act({type:'pet.select',petId:pet.id})}>{state.activePetId===pet.id?'Đang đồng hành':'Chọn đồng hành'}</ActionButton>
</>:<>
<h3>{pet.price} Vàng</h3>
<p>Đón một người bạn về căn hộ của bạn.</p>{confirm?<div className="ref-confirm" role="group" aria-label="Xác nhận nhận nuôi">
<p>Xác nhận nhận nuôi {pet.name} với {pet.price} Vàng?</p>
<ActionButton disabled={busy||state.gold<pet.price} onClick={()=>{act({type:'pet.adopt',petId:pet.id});setConfirm(false);}}>Xác nhận</ActionButton>
<ActionButton secondary onClick={()=>setConfirm(false)}>Hủy</ActionButton>
</div>:<ActionButton disabled={busy||state.gold<pet.price} onClick={()=>setConfirm(true)}>{state.gold<pet.price?'Chưa đủ Vàng':'Đón bạn về nhà'}</ActionButton>}</>}<div className="ref-pet-accessories">
<span className="ref-kicker">PHỤ KIỆN ĐỒNG HÀNH</span>{PET_ACCESSORIES.map(a=>{const has=(state.ownedPetAccessories||[]).includes(a.id),equipped=state.petAccessories?.[pet.id]===a.id;return <div key={a.id}>
<span className="ref-accessory-ring" style={{borderColor:a.color}}/>
<span>
<strong>{a.name}</strong>
<small>{has?'Đã sở hữu':`${a.price} G`}</small>
</span>
<button disabled={busy||(!has&&state.gold<a.price)||(has&&!owned)} onClick={()=>act(!has?{type:'pet.accessory.buy',accessoryId:a.id}:equipped?{type:'pet.accessory.remove',petId:pet.id}:{type:'pet.accessory.equip',petId:pet.id,accessoryId:a.id})}>{!has?'Mua':equipped?'Tháo':'Đeo'}</button>
</div>;})}</div>
<ActionButton secondary onClick={()=>navigate('home')}>Về căn hộ <ArrowRight size={16}/>
</ActionButton>
</aside>
</div>
</div>;
}


