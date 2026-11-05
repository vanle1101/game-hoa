"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, ChevronDown, ChevronRight, Layers3, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import {
  SKILL_CATEGORIES,
  TRAIT_TYPES,
  useSkillTreeStore,
  type ChildDeleteMode,
  type NewTrackedSkill,
  type NewTrait,
  type SkillCategory,
  type TrackedSkill,
  type Trait,
  type TraitType,
} from "./skill-tree-store";
import "./skill-tree-manager.css";

type DialogState = { kind: "skill"; skill?: TrackedSkill; parentId?: string } | { kind: "trait"; trait?: Trait };
type DeleteState = { kind: "skill" | "trait"; id: string } | null;

const SKILL_CATEGORY_OPTIONS: { id: SkillCategory | "all"; label: string }[] = [
  { id: "all", label: "Tất cả danh mục" },
  ...SKILL_CATEGORIES,
];

function CategoryDropdown({ value, onChange }: { value: SkillCategory | "all"; onChange: (value: SkillCategory | "all") => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const menuId = useId();
  const selectedIndex = Math.max(0, SKILL_CATEGORY_OPTIONS.findIndex((category) => category.id === value));
  const selectedLabel = SKILL_CATEGORY_OPTIONS[selectedIndex]?.label ?? "Tất cả danh mục";

  useEffect(() => {
    if (!isOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !dropdownRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const focusOption = (index: number) => optionRefs.current[index]?.focus();
  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setIsOpen(true);
    requestAnimationFrame(() => focusOption(selectedIndex));
  };
  const selectCategory = (category: SkillCategory | "all") => {
    onChange(category);
    setIsOpen(false);
    triggerRef.current?.focus();
  };
  const handleOptionKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, index: number) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectCategory(SKILL_CATEGORY_OPTIONS[index].id);
      return;
    }
    let nextIndex: number | undefined;
    if (event.key === "ArrowDown") nextIndex = (index + 1) % SKILL_CATEGORY_OPTIONS.length;
    if (event.key === "ArrowUp") nextIndex = (index - 1 + SKILL_CATEGORY_OPTIONS.length) % SKILL_CATEGORY_OPTIONS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = SKILL_CATEGORY_OPTIONS.length - 1;
    if (nextIndex !== undefined) {
      event.preventDefault();
      focusOption(nextIndex);
    }
  };

  return <div ref={dropdownRef} className="skill-tree-filter category-dropdown">
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-controls={menuId}
      aria-label={`Danh mục kỹ năng: ${selectedLabel}`}
      onClick={() => setIsOpen((open) => !open)}
      onKeyDown={handleTriggerKeyDown}
      className={`skill-tree-category-trigger w-full h-10 px-3.5 inline-flex items-center justify-between bg-slate-900/90 border rounded-lg text-xs font-medium text-slate-200 transition-all focus:outline-none ${isOpen ? "is-open" : ""}`}
    >
      <span className="truncate pr-2 leading-none text-left">{selectedLabel}</span>
      <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180 text-cyan-400" : "text-slate-400"}`} aria-hidden="true" />
    </button>
    {isOpen && <div id={menuId} role="listbox" aria-label="Danh mục kỹ năng" className="skill-tree-category-menu">
      {SKILL_CATEGORY_OPTIONS.map((category, index) => {
        const isSelected = value === category.id;
        return <div
          ref={(element) => { optionRefs.current[index] = element; }}
          key={category.id}
          role="option"
          aria-selected={isSelected}
          tabIndex={-1}
          onClick={() => selectCategory(category.id)}
          onKeyDown={(event) => handleOptionKeyDown(event, index)}
          className={`skill-tree-category-option ${isSelected ? "selected" : ""}`}
        >
          <span>{category.label}</span>
          {isSelected && <span className="skill-tree-category-selected" aria-hidden="true" />}
        </div>;
      })}
    </div>}
  </div>;
}

function Portal({ children }: { children: ReactNode }) {
  return typeof document === "undefined" ? null : createPortal(children, document.body);
}

function SkillProgress({ skill, compact = false, meta }: { skill: TrackedSkill; compact?: boolean; meta?: string }) {
  const percent = Math.max(0, Math.min(100, skill.currentXp / Math.max(1, skill.xpToNextLevel) * 100));
  return <div className={`skill-tree-progress ${compact ? "compact" : ""}`}>
    <div className="skill-tree-progress-track" role="progressbar" aria-label={`XP ${skill.name}`} aria-valuenow={skill.currentXp} aria-valuemin={0} aria-valuemax={skill.xpToNextLevel}>
      <i style={{ width: `${percent}%` }} />
    </div>
    <div className="skill-tree-progress-values"><small>{skill.currentXp.toLocaleString("vi-VN")} / {skill.xpToNextLevel.toLocaleString("vi-VN")} XP</small>{meta && <small>{meta}</small>}</div>
  </div>;
}

function SkillDialog({ initial, onClose }: { initial: DialogState; onClose: () => void }) {
  const skills = useSkillTreeStore((state) => state.skills);
  const addSkill = useSkillTreeStore((state) => state.addSkill);
  const updateSkill = useSkillTreeStore((state) => state.updateSkill);
  const addTrait = useSkillTreeStore((state) => state.addTrait);
  const updateTrait = useSkillTreeStore((state) => state.updateTrait);
  const skill = initial.kind === "skill" ? initial.skill : undefined;
  const trait = initial.kind === "trait" ? initial.trait : undefined;
  const roots = skills.filter((item) => item.parentId === null && item.id !== skill?.id);
  const hasChildren = Boolean(skill && skills.some((item) => item.parentId === skill.id));

  const submitSkill = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    const parentId = String(form.get("parentId") ?? "") || null;
    const data: NewTrackedSkill = {
      name,
      description: String(form.get("description") ?? "").trim(),
      icon: String(form.get("icon") ?? "✦").trim() || "✦",
      category: String(form.get("category") ?? "Life") as SkillCategory,
      parentId: hasChildren ? null : parentId,
    };
    if (skill) updateSkill(skill.id, data);
    else addSkill(data);
    onClose();
  };

  const submitTrait = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    const data: NewTrait = {
      name,
      description: String(form.get("description") ?? "").trim(),
      icon: String(form.get("icon") ?? "✧").trim() || "✧",
      type: String(form.get("type") ?? "Personality") as TraitType,
      buffEffect: String(form.get("buffEffect") ?? "").trim(),
    };
    if (trait) updateTrait(trait.id, data);
    else addTrait(data);
    onClose();
  };

  return <Portal><div className="skill-tree-dialog-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="skill-tree-dialog" role="dialog" aria-modal="true" aria-labelledby="skill-tree-dialog-title">
      <button type="button" className="skill-tree-dialog-close" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
      {initial.kind === "skill" ? <>
        <span className="skill-tree-dialog-kicker">CẤU HÌNH NĂNG LỰC</span>
        <h2 id="skill-tree-dialog-title">{skill ? "Chỉnh sửa kỹ năng" : initial.parentId ? "Thêm nhánh kỹ năng" : "Thêm kỹ năng"}</h2>
        <form onSubmit={submitSkill}>
          <label>Tên kỹ năng<input name="name" defaultValue={skill?.name} maxLength={80} required autoFocus placeholder="Ví dụ: Piano" /></label>
          <div className="skill-tree-form-grid">
            <label>Icon<input name="icon" defaultValue={skill?.icon ?? "✦"} maxLength={24} placeholder="♫ hoặc emoji" /></label>
            <label>Danh mục<select name="category" defaultValue={skill?.category ?? "Music"}>{SKILL_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
          </div>
          <label>Mô tả<textarea name="description" defaultValue={skill?.description} maxLength={500} rows={3} placeholder="Kỹ năng này giúp bạn phát triển điều gì?" /></label>
          <label>Kỹ năng cha<select name="parentId" defaultValue={hasChildren ? "" : skill?.parentId ?? initial.parentId ?? ""} disabled={hasChildren}>
            <option value="">Kỹ năng cha · cấp gốc</option>
            {roots.map((parent) => <option key={parent.id} value={parent.id}>{parent.icon} {parent.name}</option>)}
          </select></label>
          {hasChildren && <p className="skill-tree-dialog-note">Kỹ năng có nhánh con được giữ ở cấp cha. Hãy chuyển các nhánh con trước khi đổi cấp.</p>}
          <div className="skill-tree-dialog-actions"><button type="button" className="skill-tree-secondary" onClick={onClose}>Hủy bỏ</button><button className="skill-tree-primary" type="submit"><Sparkles size={15} />{skill ? "Lưu thay đổi" : "Tạo kỹ năng"}</button></div>
        </form>
      </> : <>
        <span className="skill-tree-dialog-kicker purple">ĐẶC ĐIỂM CÁ NHÂN</span>
        <h2 id="skill-tree-dialog-title">{trait ? "Chỉnh sửa Trait" : "Thêm Trait"}</h2>
        <form onSubmit={submitTrait}>
          <label>Tên Trait<input name="name" defaultValue={trait?.name} maxLength={80} required autoFocus placeholder="Ví dụ: Fast Learner" /></label>
          <div className="skill-tree-form-grid">
            <label>Icon<input name="icon" defaultValue={trait?.icon ?? "✧"} maxLength={24} /></label>
            <label>Loại Trait<select name="type" defaultValue={trait?.type ?? "Personality"}>{TRAIT_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          </div>
          <label>Mô tả<textarea name="description" defaultValue={trait?.description} maxLength={500} rows={3} /></label>
          <label>Hiệu ứng buff<input name="buffEffect" defaultValue={trait?.buffEffect} maxLength={180} placeholder="+10% XP kỹ năng khi…" /></label>
          <div className="skill-tree-dialog-actions"><button type="button" className="skill-tree-secondary" onClick={onClose}>Hủy bỏ</button><button className="skill-tree-primary purple" type="submit"><Sparkles size={15} />{trait ? "Lưu thay đổi" : "Tạo Trait"}</button></div>
        </form>
      </>}
    </section>
  </div></Portal>;
}

function DeleteDialog({ value, onClose }: { value: DeleteState; onClose: () => void }) {
  const skills = useSkillTreeStore((state) => state.skills);
  const traits = useSkillTreeStore((state) => state.traits);
  const deleteSkill = useSkillTreeStore((state) => state.deleteSkill);
  const deleteTrait = useSkillTreeStore((state) => state.deleteTrait);
  if (!value) return null;
  const skill = value.kind === "skill" ? skills.find((item) => item.id === value.id) : undefined;
  const trait = value.kind === "trait" ? traits.find((item) => item.id === value.id) : undefined;
  const children = skill ? skills.filter((item) => item.parentId === skill.id) : [];
  const remove = (mode: ChildDeleteMode) => { deleteSkill(value.id, mode); onClose(); };
  return <Portal><div className="skill-tree-dialog-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="skill-tree-dialog delete" role="alertdialog" aria-modal="true" aria-labelledby="skill-tree-delete-title">
      <button type="button" className="skill-tree-dialog-close" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
      <span className="skill-tree-dialog-kicker danger">XÁC NHẬN XÓA</span>
      <h2 id="skill-tree-delete-title">Xóa {skill ? `“${skill.name}”` : `Trait “${trait?.name ?? ""}”`}?</h2>
      {children.length > 0 ? <>
        <p>Kỹ năng này có {children.length} nhánh con. Chọn cách xử lý các nhánh:</p>
        <div className="skill-tree-delete-options">
          <button type="button" className="skill-tree-danger" onClick={() => remove("delete-children")}><Trash2 size={15} />Xóa kỹ năng và {children.length} nhánh con</button>
          <button type="button" className="skill-tree-secondary" onClick={() => remove("promote-children")}><ArrowUpRight size={15} />Giữ nhánh con thành kỹ năng gốc</button>
        </div>
      </> : <>
        <p>Thao tác này sẽ xóa dữ liệu khỏi cây kỹ năng của hồ sơ hiện tại.</p>
        <div className="skill-tree-dialog-actions"><button type="button" className="skill-tree-secondary" onClick={onClose}>Hủy bỏ</button><button type="button" className="skill-tree-danger" onClick={() => value.kind === "skill" ? remove("promote-children") : (deleteTrait(value.id), onClose())}><Trash2 size={15} />Xóa</button></div>
      </>}
    </section>
  </div></Portal>;
}

export function SkillTreeManager() {
  const ownerId = useSkillTreeStore((state) => state.ownerId);
  const hydrated = useSkillTreeStore((state) => state.hydrated);
  const skills = useSkillTreeStore((state) => state.skills);
  const traits = useSkillTreeStore((state) => state.traits);
  const activeTab = useSkillTreeStore((state) => state.activeTab);
  const filterCategory = useSkillTreeStore((state) => state.filterCategory);
  const searchQuery = useSkillTreeStore((state) => state.searchQuery);
  const setActiveTab = useSkillTreeStore((state) => state.setActiveTab);
  const setFilterCategory = useSkillTreeStore((state) => state.setFilterCategory);
  const setSearchQuery = useSkillTreeStore((state) => state.setSearchQuery);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteState>(null);

  const visibleRoots = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("vi");
    const matchesText = (item: { name: string; description: string }) => !query || `${item.name} ${item.description}`.toLocaleLowerCase("vi").includes(query);
    return skills.filter((root) => root.parentId === null).map((root) => {
      const allChildren = skills.filter((child) => child.parentId === root.id);
      const categoryChildren = allChildren.filter((child) => filterCategory === "all" || child.category === filterCategory);
      const rootCategoryMatch = filterCategory === "all" || root.category === filterCategory;
      const rootTextMatch = matchesText(root);
      const matchingChildren = categoryChildren.filter(matchesText);
      const children = query && rootTextMatch ? categoryChildren : matchingChildren;
      return { root, children, matches: (rootCategoryMatch || matchingChildren.length > 0) && (rootTextMatch || children.length > 0) };
    }).filter((item) => item.matches);
  }, [skills, filterCategory, searchQuery]);

  const visibleTraits = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("vi");
    return traits.filter((trait) => !query || `${trait.name} ${trait.description} ${trait.buffEffect}`.toLocaleLowerCase("vi").includes(query));
  }, [traits, searchQuery]);

  const saveDialog = (value: DialogState) => setDialog(value);

  if (!ownerId || !hydrated) return <section className="skill-tree-manager" aria-busy="true"><p className="skill-tree-loading">Đang đồng bộ cây kỹ năng với hồ sơ…</p></section>;

  return <section className="skill-tree-manager" aria-label="Quản lý kỹ năng và đặc điểm">
    <div className="skill-tree-toolbar">
      <div className="skill-tree-tabs" role="tablist" aria-label="Nhóm tiến trình">
        <button role="tab" aria-selected={activeTab === "skills"} className={activeTab === "skills" ? "active" : ""} onClick={() => setActiveTab("skills")}><Layers3 size={15} />Kỹ năng<span>{skills.length}</span></button>
        <button role="tab" aria-selected={activeTab === "traits"} className={activeTab === "traits" ? "active purple" : ""} onClick={() => setActiveTab("traits")}><Sparkles size={15} />Đặc điểm<span>{traits.length}</span></button>
      </div>
      <label className="skill-tree-search"><Search size={16} aria-hidden="true" /><input aria-label="Tìm kỹ năng hoặc Trait" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={activeTab === "skills" ? "Tìm kỹ năng…" : "Tìm đặc điểm…"} style={{ textAlign: "center", outline: "none", boxShadow: "none" }} /></label>
      <div className="skill-tree-toolbar-actions">
        {activeTab === "skills" && <><span className="sr-only" id="skill-category-label">Lọc theo danh mục</span><CategoryDropdown value={filterCategory} onChange={setFilterCategory} /></>}
        {activeTab === "skills" ? <button className="skill-tree-add" onClick={() => saveDialog({ kind: "skill" })}><Plus size={16} />Thêm kỹ năng</button> : <button className="skill-tree-add purple" onClick={() => saveDialog({ kind: "trait" })}><Plus size={16} />Thêm Trait</button>}
      </div>
    </div>

    <div className="skill-tree-scroll" role="tabpanel" aria-label={activeTab === "skills" ? "Cây kỹ năng" : "Đặc điểm cá nhân"}>
      {activeTab === "skills" ? <>
        <div className="skill-tree-summary"><span><i />{skills.filter((skill) => skill.parentId === null).length} nhóm kỹ năng</span><span>{skills.filter((skill) => skill.parentId !== null).length} nhánh con</span><span>Cấp tối đa 100</span></div>
        {visibleRoots.length ? <div className="skill-tree-list">{visibleRoots.map(({ root, children }) => {
          const isExpanded = expanded[root.id] ?? true;
          return <article className="skill-tree-parent" key={root.id}>
            <div className="skill-tree-parent-head">
              <button className="skill-tree-expand" aria-expanded={isExpanded} aria-label={`${isExpanded ? "Thu gọn" : "Mở rộng"} ${root.name}`} onClick={() => setExpanded((current) => ({ ...current, [root.id]: !isExpanded }))}>{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
              <span className="skill-tree-icon">{root.icon || "✦"}</span>
              <div className="skill-tree-name"><strong>{root.name}</strong><small>{root.description || "Nhóm kỹ năng"}</small></div>
              <span className="skill-tree-level">LV <b>{root.level}</b></span>
              <div className="skill-tree-parent-xp"><SkillProgress skill={root} meta={`${children.length} nhánh con`} /></div>
              <span className="skill-tree-child-count">{children.length} nhánh con</span>
              <div className="skill-tree-actions">
                <button className="add-child" onClick={() => saveDialog({ kind: "skill", parentId: root.id })} aria-label={`Thêm kỹ năng con cho ${root.name}`}><Plus size={14} /><span>Con</span></button>
                <button onClick={() => saveDialog({ kind: "skill", skill: root })} aria-label={`Sửa ${root.name}`}><Pencil size={14} /></button>
                <button className="delete" onClick={() => setDeleteTarget({ kind: "skill", id: root.id })} aria-label={`Xóa ${root.name}`}><Trash2 size={14} /></button>
              </div>
            </div>
            {isExpanded && children.length > 0 && <div className="skill-tree-children">{children.map((child) => <div className="skill-tree-child" key={child.id}>
              <span className="skill-tree-connector" aria-hidden="true" />
              <span className="skill-tree-child-icon">{child.icon || "✧"}</span>
              <div className="skill-tree-name"><strong>{child.name}</strong><small>{child.description || "Kỹ năng con"}</small></div>
              <span className="skill-tree-level child">LV <b>{child.level}</b></span>
              <div className="skill-tree-child-xp"><SkillProgress skill={child} compact /></div>
              <div className="skill-tree-actions compact"><button onClick={() => saveDialog({ kind: "skill", skill: child })} aria-label={`Sửa ${child.name}`}><Pencil size={13} /></button><button className="delete" onClick={() => setDeleteTarget({ kind: "skill", id: child.id })} aria-label={`Xóa ${child.name}`}><Trash2 size={13} /></button></div>
            </div>)}</div>}
            {isExpanded && children.length === 0 && <button className="skill-tree-first-child" onClick={() => saveDialog({ kind: "skill", parentId: root.id })}><Plus size={13} />Thêm nhánh đầu tiên</button>}
          </article>;
        })}</div> : <div className="skill-tree-empty"><span>✦</span><strong>{skills.length ? "Không tìm thấy kỹ năng phù hợp" : "Cây kỹ năng còn trống"}</strong><p>{skills.length ? "Thử từ khóa hoặc danh mục khác." : "Tạo một kỹ năng cha để bắt đầu xây dựng hành trình."}</p>{!skills.length && <button className="skill-tree-add" onClick={() => saveDialog({ kind: "skill" })}><Plus size={15} />Tạo kỹ năng đầu tiên</button>}</div>}
      </> : <>
        <div className="skill-tree-summary"><span><i className="purple" />ĐẶC ĐIỂM THEO PHONG CÁCH THE SIMS</span><span>{traits.length} Trait đang lưu</span></div>
        {visibleTraits.length ? <div className="skill-tree-traits">{visibleTraits.map((trait) => <article className="skill-tree-trait" key={trait.id}>
          <div className="skill-tree-trait-top"><span className="skill-tree-trait-icon">{trait.icon || "✧"}</span><span className="skill-tree-trait-type">{TRAIT_TYPES.find((item) => item.id === trait.type)?.label ?? trait.type}</span><div className="skill-tree-actions compact"><button onClick={() => saveDialog({ kind: "trait", trait })} aria-label={`Sửa Trait ${trait.name}`}><Pencil size={13} /></button><button className="delete" onClick={() => setDeleteTarget({ kind: "trait", id: trait.id })} aria-label={`Xóa Trait ${trait.name}`}><Trash2 size={13} /></button></div></div>
          <h3>{trait.name}</h3><p>{trait.description}</p><div className="skill-tree-buff"><Sparkles size={13} /><span>{trait.buffEffect || "Chưa cấu hình hiệu ứng."}</span></div>
        </article>)}</div> : <div className="skill-tree-empty"><span>✧</span><strong>Chưa có Trait phù hợp</strong><p>Thêm đặc điểm để định hình phong cách phát triển của bạn.</p><button className="skill-tree-add purple" onClick={() => saveDialog({ kind: "trait" })}><Plus size={15} />Thêm Trait</button></div>}
      </>}
    </div>
    {dialog && <SkillDialog key={`${dialog.kind}:${dialog.kind === "skill" ? dialog.skill?.id ?? dialog.parentId ?? "new" : dialog.trait?.id ?? "new"}`} initial={dialog} onClose={() => setDialog(null)} />}
    <DeleteDialog value={deleteTarget} onClose={() => setDeleteTarget(null)} />
  </section>;
}
