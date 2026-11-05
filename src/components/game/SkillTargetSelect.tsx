"use client";

import { useSkillTreeStore } from "./skill-tree-store";

export function SkillTargetSelect({ name = "targetSkillId", defaultValue = null }: { name?: string; defaultValue?: string | null }) {
  const skills = useSkillTreeStore((state) => state.skills);
  const hydrated = useSkillTreeStore((state) => state.hydrated);
  const roots = skills.filter((skill) => skill.parentId === null);
  const targetExists = !defaultValue || skills.some((skill) => skill.id === defaultValue);

  return (
    <select name={name} defaultValue={defaultValue ?? ""} disabled={!hydrated}>
      <option value="">{hydrated ? "Không liên kết kỹ năng" : "Đang tải cây kỹ năng…"}</option>
      {defaultValue && !targetExists && <option value={defaultValue}>Kỹ năng đã xóa · XP không cộng</option>}
      {roots.map((parent) => (
        <optgroup key={parent.id} label={`${parent.icon} ${parent.name}`}>
          <option value={parent.id}>{parent.icon} {parent.name} · kỹ năng cha</option>
          {skills.filter((skill) => skill.parentId === parent.id).map((child) => (
            <option key={child.id} value={child.id}>└ {child.icon} {child.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function SkillTargetBadge({ skillId, xpReward }: { skillId?: string | null; xpReward?: number }) {
  const skill = useSkillTreeStore((state) => skillId ? state.skills.find((item) => item.id === skillId) : undefined);
  if (!skillId) return null;
  return <span className="target-skill-tag" title={skill ? `${skill.name} · +${xpReward ?? 100} XP khi hoàn thành` : "Kỹ năng đã bị xóa; XP sẽ không được cộng"}>
    <span aria-hidden="true">{skill?.icon ?? "✦"}</span>{skill?.name ?? "Kỹ năng đã xóa"} · +{xpReward ?? 100} XP
  </span>;
}
