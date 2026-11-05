"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Archive,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Coins,
  Edit3,
  Filter,
  Flag,
  Heart,
  ListChecks,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Sword,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { Action, GameState, Task, TaskInput, TaskOccurrence } from "@/domain/types";
import { BOSSES, REWARDS } from "@/domain/catalog";
import { damagePreview, dateKey } from "@/domain/engine";
import { matchesQuest, taskEditPatch } from "./quest-model";
import { SkillTargetBadge, SkillTargetSelect } from "./SkillTargetSelect";
import "./quest.css";

export type QuestManagerProps = {
  state: GameState;
  act: (action: Action) => void;
  busy: boolean;
  onCreate: () => void;
};

const kinds: Record<Task["kind"], string> = {
  once: "Một lần",
  daily: "Hằng ngày",
  weekly: "Hằng tuần",
  habit: "Thói quen tốt",
  "negative-habit": "Tránh thói quen xấu",
  campaign: "Chiến dịch",
  farming: "Thu thập",
  recovery: "Hồi phục",
};

const skills: Record<Task["skill"], string> = {
  health: "Sức khỏe",
  knowledge: "Kiến thức",
  career: "Sự nghiệp",
  finance: "Kỹ năng tài chính",
  relationships: "Quan hệ",
  creativity: "Sáng tạo",
};

const skillIcons: Record<Task["skill"], typeof ListChecks> = {
  health: Heart,
  knowledge: BookOpen,
  career: BriefcaseBusiness,
  finance: Coins,
  relationships: Users,
  creativity: Sparkles,
};

const difficulties: Record<Task["difficulty"], string> = {
  easy: "Dễ",
  medium: "Vừa",
  hard: "Khó",
  epic: "Sử thi",
};

const priorityNames: Record<Task["priority"], string> = {
  low: "Thấp",
  normal: "Bình thường",
  high: "Ưu tiên cao",
};

const recurring = new Set([
  "daily",
  "weekly",
  "habit",
  "negative-habit",
  "farming",
  "recovery",
]);

const statusNames: Record<TaskOccurrence["status"], string> = {
  open: "Đang mở",
  completed: "Đã hoàn thành",
  missed: "Đã bỏ lỡ",
  canceled: "Đã hủy",
};

const statusOptions: [string, string][] = [
  ["today", "Hôm nay"],
  ["open", "Đang mở"],
  ["overdue", "Quá hạn / bỏ lỡ"],
  ["committed", "Đã cam kết"],
  ["completed", "Có lượt hoàn thành"],
  ["all", "Tất cả đang theo dõi"],
  ["archived", "Đã lưu trữ"],
];

export function QuestManager({ state, act, busy, onCreate }: QuestManagerProps) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [priority, setPriority] = useState("all");
  const [status, setStatus] = useState("today");
  const [now, setNow] = useState(() => new Date().toISOString());
  const [editing, setEditing] = useState<string>();
  const [expanded, setExpanded] = useState<string>();
  const [confirmation, setConfirmation] = useState<{
    action: Action;
    title: string;
    description: string;
  }>();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const today = dateKey(now, state.settings.timezone);
  const visible = useMemo(
    () =>
      state.tasks
        .filter((task) =>
          matchesQuest(
            task,
            state.occurrences,
            { search, kind, priority, status },
            dateKey(now, task.timezone),
          ),
        )
        .sort(
          (a, b) =>
            Number(b.priority === "high") - Number(a.priority === "high") ||
            a.dueDate.localeCompare(b.dueDate),
        ),
    [state.tasks, state.occurrences, search, kind, priority, status, now],
  );

  const open = state.occurrences.filter(
    (row) =>
      row.status === "open" &&
      !state.tasks.find((task) => task.id === row.taskId)?.archived,
  );
  const missed = open.filter((row) => {
    const task = state.tasks.find((item) => item.id === row.taskId);
    return task && row.date < dateKey(now, task.timezone);
  });
  const completed = state.occurrences.filter(
    (row) =>
      row.status === "completed" &&
      row.completedAt &&
      dateKey(row.completedAt, state.settings.timezone) === today,
  ).length;
  const editTask = state.tasks.find((task) => task.id === editing);
  const hasActiveFilters =
    search.trim().length > 0 ||
    kind !== "all" ||
    priority !== "all" ||
    status !== "all";

  return (
    <div className="quest-manager" data-reduced-motion={state.settings.reducedMotion}>
      <div className="quest-journal-caption">
        <span><BookOpen size={16} aria-hidden="true" /> NHẬT KÝ HÀNH TRÌNH</span>
        <span><CalendarDays size={14} aria-hidden="true" /><time dateTime={today}>{today.split("-").reverse().join(" / ")}</time></span>
      </div>
      <div className="stats-strip" role="region" aria-label="Tổng quan nhiệm vụ">
        <div className="quest-stat-card is-open">
          <div className="quest-stat-meta">
            <span className="eyebrow"><ListChecks size={14} aria-hidden="true" /> NHIỆM VỤ</span>
            <span>Đang mở</span>
          </div>
          <strong>{open.length}</strong>
        </div>
        <div className="quest-stat-card is-done">
          <div className="quest-stat-meta">
            <span className="eyebrow"><Check size={14} aria-hidden="true" /> BƯỚC TIẾN</span>
            <span>Hoàn thành hôm nay</span>
          </div>
          <strong>{completed}</strong>
        </div>
        <div className={`quest-stat-card ${missed.length > 0 ? "is-alert" : "is-clear"}`}>
          <div className="quest-stat-meta">
            <span className="eyebrow"><Clock3 size={14} aria-hidden="true" /> CẦN CHÚ Ý</span>
            <span>Chưa đối soát quá hạn</span>
          </div>
          <strong>{missed.length}</strong>
        </div>
      </div>

      {missed.length > 0 && (
        <section className="panel quest-warning" role="status">
          <div className="quest-warning-icon">
            <CircleAlert size={20} />
          </div>
          <div className="quest-warning-copy">
            <span className="eyebrow">CẢNH BÁO ĐỐI SOÁT</span>
            <strong>{missed.length} lượt đã qua hạn</strong>
            <p>
              Đối soát sẽ ghi nhận lượt bỏ lỡ và áp dụng luật đã cam kết. Không tự thay đổi deadline.
            </p>
          </div>
          <button
            className="btn ghost"
            disabled={busy}
            onClick={() =>
              setConfirmation({
                action: { type: "reconcile" },
                title: "Đối soát lịch nhiệm vụ?",
                description: `${missed.length} lượt quá hạn sẽ được xử lý. ${
                  state.settings.hardcore
                    ? "Nhiệm vụ cam kết có thể bị trừ HP theo độ khó; nếu HP về 0, luật kiệt sức sẽ được áp dụng."
                    : "Standard Mode không trừ HP cho lượt bỏ lỡ."
                }`,
              })
            }
          >
            Xem & đối soát
          </button>
        </section>
      )}

      <section className="panel quest-command-bar" aria-label="Bộ lọc và tìm kiếm nhiệm vụ">
        <div className="quest-toolbar">
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Tìm nhiệm vụ"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên hoặc mô tả…"
            />
          </label>
          <button className="btn primary quest-create-btn" onClick={onCreate}>
            <Plus size={16} />
            Nhiệm vụ mới
          </button>
        </div>

        <details className="quest-filter-disclosure">
          <summary><Filter size={14} aria-hidden="true" /> Bộ lọc chi tiết <span>Loại · ưu tiên · trạng thái</span><ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="quest-filters">
          <label>
            <span className="quest-filter-label">
              <Filter size={13} />
              Loại
            </span>
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="all">Mọi loại nhiệm vụ</option>
              {Object.entries(kinds).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="quest-filter-label">
              <Flag size={13} />
              Ưu tiên
            </span>
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="all">Mọi mức ưu tiên</option>
              {Object.entries(priorityNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="quest-filter-label">
              <CalendarDays size={13} />
              Trạng thái
            </span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="text-link quest-reset-filter"
            disabled={!hasActiveFilters}
            onClick={() => {
              setSearch("");
              setKind("all");
              setPriority("all");
              setStatus("all");
            }}
          >
            Xóa bộ lọc
          </button>
        </div>
        </details>

        <div className="quest-status-pills" role="group" aria-label="Chế độ xem nhanh">
          {statusOptions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`quest-status-pill ${status === value ? "active" : ""}`}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="quest-result-bar">
        <div>
          <span className="eyebrow">DANH SÁCH NHIỆM VỤ</span>
          <h2>{statusOptions.find(([value]) => value === status)?.[1]}</h2>
        </div>
        <p className="quest-result-count" aria-live="polite">
          <strong>{visible.length}</strong> nhiệm vụ
          <span>Múi giờ · {state.settings.timezone}</span>
        </p>
      </div>

      {!visible.length ? (
        <section className="panel quest-empty">
          <div className="quest-empty-emblem">
            <ListChecks size={34} />
          </div>
          <span className="eyebrow">MỘT KHOẢNG TRỐNG CHO BƯỚC TIẾN MỚI</span>
          <h3>{search.trim() ? "Chưa tìm thấy nhiệm vụ phù hợp" : "Không có nhiệm vụ trong mục này"}</h3>
          <p>{search.trim() ? "Thử một từ khóa khác hoặc xóa bộ lọc để xem lại hành trình của bạn." : "Hành trình lớn bắt đầu từ một việc nhỏ. Chọn mục khác hoặc tạo nhiệm vụ đầu tiên của bạn."}</p>
          <button className="btn primary" onClick={onCreate}>
            <Plus size={16} />
            Tạo nhiệm vụ
          </button>
        </section>
      ) : (
        <div className="quest-cards">
          {visible.map((task) => {
            const taskToday = dateKey(now, task.timezone);
            const rows = state.occurrences
              .filter((row) => row.taskId === task.id)
              .sort((a, b) => b.date.localeCompare(a.date));
            const available = rows
              .filter((row) => row.status === "open")
              .sort((a, b) => a.date.localeCompare(b.date));
            const occurrence = available[0];
            const overdue = available.some((row) => row.date < taskToday);
            const editAllowed =
              !task.archived &&
              !overdue &&
              (available.length > 0 || recurring.has(task.kind));
            const checkedCount = task.checklist.filter((item) => item.done).length;
            const allChecked = task.checklist.every((item) => item.done);
            const canComplete =
              occurrence &&
              !task.archived &&
              occurrence.date <= taskToday &&
              (!task.committed || occurrence.date >= taskToday) &&
              allChecked;
            const encounter = state.bosses.find(
              (boss) => boss.id === (task.bossId ?? state.activeBossId),
            );
            const eligibleBoss =
              encounter &&
              !encounter.defeatedAt &&
              (!encounter.campaignId || encounter.campaignId === task.campaignId);
            const damage = eligibleBoss
              ? damagePreview(state, task.difficulty, encounter.id)
              : undefined;
            const penalty =
              task.committed && state.settings.hardcore
                ? REWARDS[task.difficulty].penalty
                : 0;
            const totalDone = rows.filter((row) => row.status === "completed").length;
            const SkillIcon = skillIcons[task.skill] ?? ListChecks;
            const checklistPercent =
              task.checklist.length > 0
                ? Math.round((checkedCount / task.checklist.length) * 100)
                : 0;

            return (
              <article
                className={`panel quest-card difficulty-${task.difficulty} priority-${task.priority} ${
                  overdue ? "is-overdue" : ""
                } ${task.archived ? "is-archived" : ""} ${
                  expanded === task.id ? "is-expanded" : ""
                }`}
                key={task.id}
              >
                <div className="quest-card-head">
                  <div className={`quest-kind-icon skill-${task.skill}`}>
                    <SkillIcon size={21} />
                  </div>
                  <div className="quest-card-title">
                    <div className="quest-tags">
                      <span className="kind-tag">{kinds[task.kind]}</span>
                      <span className={`skill-tag skill-${task.skill}`}>
                        {skills[task.skill]}
                      </span>
                      <SkillTargetBadge skillId={task.targetSkillId} xpReward={task.xpReward} />
                      <span className={`difficulty-tag difficulty-${task.difficulty}`}>
                        {difficulties[task.difficulty]}
                      </span>
                      {task.priority === "high" && (
                        <span className="priority-tag">
                          <Flag size={11} />
                          Ưu tiên cao
                        </span>
                      )}
                      {task.committed && (
                        <span className="commit-tag">
                          <ShieldCheck size={11} />
                          Cam kết
                        </span>
                      )}
                      {overdue && <span className="overdue-tag">Quá hạn</span>}
                      {task.archived && <span className="archived-tag">Đã lưu trữ</span>}
                    </div>
                    <h3>{task.title}</h3>
                    {task.description && <p>{task.description}</p>}
                  </div>
                  <button
                    className={`icon-button quest-expand-btn ${
                      expanded === task.id ? "active" : ""
                    }`}
                    aria-label={`Chi tiết ${task.title}`}
                    aria-expanded={expanded === task.id}
                    onClick={() =>
                      setExpanded(expanded === task.id ? undefined : task.id)
                    }
                  >
                    <ChevronDown size={18} />
                  </button>
                </div>

                <div className="quest-telemetry-row">
                  <div className="quest-meta">
                    <span>
                      <Clock3 size={13} />
                      {task.duration} phút
                    </span>
                    <span>
                      {difficulties[task.difficulty]} · {skills[task.skill]}
                    </span>
                    <span className={overdue ? "is-overdue-date" : ""}>
                      <CalendarDays size={13} />
                      {occurrence?.date ?? task.dueDate}
                      {overdue ? " · quá hạn" : ""}
                    </span>
                    <span>{task.timezone}</span>
                  </div>

                  <div className="quest-rewards">
                    <span className="reward-xp">
                      <Zap size={13} />
                      {REWARDS[task.difficulty].xp} XP cơ bản
                    </span>
                    <span className="reward-gold">
                      <Coins size={13} />
                      Tối đa {REWARDS[task.difficulty].gold} G
                    </span>
                    {damage && damage.normal > 0 && (
                      <span className="reward-damage">
                        <Sword size={13} />
                        {damage.normal}–{damage.critical} sát thương dự kiến
                      </span>
                    )}
                    {penalty > 0 && (
                      <span className="penalty">Bỏ cam kết: −{penalty} HP</span>
                    )}
                  </div>
                </div>

                {task.checklist.length > 0 && (
                  <div className="quest-checklist">
                    <div className="quest-checklist-head">
                      <span>
                        Tiến độ bước thực hiện: {checkedCount}/{task.checklist.length}
                      </span>
                      <strong>{checklistPercent}%</strong>
                    </div>
                    <div className="quest-checklist-bar" aria-hidden="true">
                      <i style={{ width: `${checklistPercent}%` }} />
                    </div>
                    <div className="quest-checklist-items">
                      {task.checklist.map((item) => (
                        <label key={item.id} className={item.done ? "is-done" : ""}>
                          <input
                            type="checkbox"
                            checked={item.done}
                            disabled={busy || task.archived || !available.length}
                            onChange={(event) =>
                              act({
                                type: "task.checklist",
                                taskId: task.id,
                                checklistId: item.id,
                                done: event.target.checked,
                              })
                            }
                          />
                          <span className={item.done ? "checked" : ""}>
                            {item.title}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="quest-card-actions">
                  <button
                    className="btn primary"
                    disabled={busy || !canComplete}
                    title={
                      !allChecked
                        ? "Hoàn thành checklist trước"
                        : occurrence && occurrence.date > taskToday
                          ? "Nhiệm vụ chưa đến ngày"
                          : undefined
                    }
                    onClick={() => {
                      if (occurrence)
                        act({ type: "task.complete", occurrenceId: occurrence.id });
                    }}
                  >
                    <Check size={15} />
                    {task.kind === "negative-habit"
                      ? "Đã tránh thói quen này"
                      : "Hoàn thành ngoài đời"}
                  </button>
                  <button
                    className="btn ghost"
                    disabled={busy || !editAllowed}
                    title={
                      overdue
                        ? "Đối soát lượt quá hạn trước khi sửa"
                        : !editAllowed
                          ? "Nhiệm vụ một lần đã đóng không thể sửa"
                          : undefined
                    }
                    onClick={() => setEditing(task.id)}
                  >
                    <Edit3 size={14} />
                    Sửa
                  </button>
                  {occurrence && occurrence.date >= today && !task.archived && (
                    <button
                      className="text-link quest-cancel-link"
                      disabled={busy}
                      onClick={() =>
                        setConfirmation({
                          action: {
                            type: "task.cancel",
                            occurrenceId: occurrence.id,
                          },
                          title: "Hủy lượt nhiệm vụ này?",
                          description: `Lượt ngày ${occurrence.date} sẽ đóng mà không nhận thưởng. Cam kết của nhiệm vụ sẽ được tắt. Lịch sử vẫn được giữ lại.`,
                        })
                      }
                    >
                      Hủy lượt
                    </button>
                  )}
                  {!task.archived && (
                    <button
                      className="icon-button quest-archive-btn"
                      aria-label={`Lưu trữ ${task.title}`}
                      disabled={busy || (task.committed && overdue)}
                      onClick={() =>
                        setConfirmation({
                          action: { type: "task.archive", taskId: task.id },
                          title: "Lưu trữ nhiệm vụ?",
                          description:
                            "Các lượt đang mở sẽ được hủy, nhiệm vụ ngừng xuất hiện hằng ngày. Lịch sử phần thưởng và các lượt cũ được giữ lại. Không thể khôi phục qua màn hình này.",
                        })
                      }
                    >
                      <Archive size={15} />
                    </button>
                  )}
                  <small className="quest-done-counter">
                    {totalDone} lượt hoàn thành
                  </small>
                </div>

                {expanded === task.id && (
                  <div className="quest-expanded">
                    {encounter && (
                      <p className="quest-boss-link">
                        <Sword size={14} />
                        <span>
                          Boss:{" "}
                          <strong>
                            {BOSSES.find((boss) => boss.id === encounter.definitionId)
                              ?.name ?? encounter.definitionId}
                          </strong>
                          {!eligibleBoss
                            ? " · không đủ điều kiện gây sát thương từ nhiệm vụ này"
                            : ""}
                          {damage?.campaignGated
                            ? " · chiến dịch vẫn cần đủ mốc bắt buộc"
                            : ""}
                        </span>
                      </p>
                    )}
                    <p className="quest-authority-note">
                      XP thực tế điều chỉnh theo thời lượng và ngân sách thưởng ngày. Sát thương có thể thay đổi theo buff, kháng và chí mạng; máy chủ quyết định kết quả.
                    </p>
                    <h4>Lịch sử các lượt</h4>
                    {rows.length ? (
                      <ul>
                        {rows.slice(0, 12).map((row) => (
                          <li key={row.id}>
                            <time>{row.date}</time>
                            <span className={`occurrence-${row.status}`}>
                              {statusNames[row.status]}
                            </span>
                            {row.penaltyEventId && (
                              <small>Đã đối soát hình phạt</small>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Chưa có lượt thực hiện.</p>
                    )}
                    {rows.length > 12 && (
                      <p>Hiển thị 12 lượt gần nhất. Toàn bộ sự kiện nằm trong Nhật ký.</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <p className="footnote">
        Chỉ đánh dấu sau khi đã hoàn thành việc ngoài đời. Không có hành động tấn công miễn phí; thưởng và sát thương được xác nhận trên máy chủ.
      </p>

      {editTask && (
        <EditQuest
          key={editTask.id}
          task={editTask}
          state={state}
          busy={busy}
          act={act}
          onClose={() => setEditing(undefined)}
        />
      )}

      {confirmation && (
        <div className="modal-scrim">
          <section
            className="modal quest-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quest-confirm-title"
          >
            <button
              className="modal-close"
              aria-label="Đóng"
              onClick={() => setConfirmation(undefined)}
            >
              <X />
            </button>
            <span className="eyebrow">XÁC NHẬN THAY ĐỔI</span>
            <h2 id="quest-confirm-title">{confirmation.title}</h2>
            <p>{confirmation.description}</p>
            <div className="button-row">
              <button
                className="btn ghost"
                onClick={() => setConfirmation(undefined)}
              >
                Giữ nguyên
              </button>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => {
                  act(confirmation.action);
                  setConfirmation(undefined);
                }}
              >
                Xác nhận
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function EditQuest({
  task,
  state,
  busy,
  act,
  onClose,
}: {
  task: Task;
  state: GameState;
  busy: boolean;
  act: QuestManagerProps["act"];
  onClose: () => void;
}) {
  const [notice, setNotice] = useState("");
  const originalChecklist = task.checklist.map((item) => item.title).join("\n");
  const [checklist, setChecklist] = useState(originalChecklist);
  const checklistChanged = checklist.trim() !== originalChecklist.trim();
  const [sent, setSent] = useState(false);
  const [originalRevision] = useState(state.revision);

  useEffect(() => {
    if (sent && state.revision > originalRevision) {
      const event = state.journal.at(-1);
      if (event?.type === "task.edit" && event.data.taskId === task.id) onClose();
    }
  }, [sent, state.revision, state.journal, originalRevision, task.id, onClose]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "");
    const values: TaskInput = {
      title: text("title").trim(),
      description: text("description"),
      skill: text("skill") as Task["skill"],
      targetSkillId: text("targetSkillId") || null,
      xpReward: Number(text("xpReward")),
      priority: text("priority") as Task["priority"],
      checklist: checklist
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    };
    if (!task.committed) {
      values.kind = task.campaignId ? "campaign" : (text("kind") as Task["kind"]);
      values.difficulty = text("difficulty") as Task["difficulty"];
      values.duration = Number(text("duration"));
      values.dueDate = text("dueDate");
      values.timezone = text("timezone");
      values.committed = data.get("committed") === "on";
    }
    const bossId = text("bossId");
    if (bossId) values.bossId = bossId;
    const patch = taskEditPatch(task, values);
    if (!Object.keys(patch).length) {
      setNotice("Chưa có thay đổi để lưu.");
      return;
    }
    if (values.checklist!.length > 30) {
      setNotice("Checklist tối đa 30 mục.");
      return;
    }
    act({ type: "task.edit", taskId: task.id, task: patch });
    setSent(true);
  };

  return (
    <div className="modal-scrim">
      <section
        className="modal quest-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quest-edit-title"
      >
        <button
          className="modal-close"
          aria-label="Đóng chỉnh sửa"
          onClick={onClose}
        >
          <X />
        </button>
        <span className="eyebrow">ĐIỀU CHỈNH BƯỚC TIẾN TIẾP THEO</span>
        <h2 id="quest-edit-title">Chỉnh sửa nhiệm vụ</h2>
        {task.committed && (
          <p className="quest-lock-note">
            <ShieldCheck size={15} />
            Deadline, lịch lặp, độ khó và thời lượng đang được khóa theo cam kết. Hủy lượt cam kết trước khi đổi các trường này.
          </p>
        )}
        <form onSubmit={submit}>
          <label>
            Tên nhiệm vụ
            <input
              name="title"
              defaultValue={task.title}
              maxLength={120}
              required
              autoFocus
            />
          </label>
          <label>
            Mô tả
            <textarea
              name="description"
              defaultValue={task.description}
              rows={3}
              maxLength={2000}
            />
          </label>
          <div className="form-grid">
            <label>
              Loại
              <select
                name="kind"
                defaultValue={task.kind}
                disabled={task.committed || !!task.campaignId}
              >
                {Object.entries(kinds).map(([value, label]) => (
                  <option
                    key={value}
                    value={value}
                    disabled={value === "campaign" && !task.campaignId}
                  >
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ưu tiên
              <select name="priority" defaultValue={task.priority}>
                {Object.entries(priorityNames).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Độ khó
              <select
                name="difficulty"
                defaultValue={task.difficulty}
                disabled={task.committed}
              >
                {Object.entries(difficulties).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Thời lượng (phút)
              <input
                name="duration"
                type="number"
                min={1}
                max={240}
                step={1}
                defaultValue={task.duration}
                disabled={task.committed}
                required
              />
            </label>
            <label>
              Ngày đến hạn
              <input
                name="dueDate"
                type="date"
                defaultValue={task.dueDate}
                disabled={task.committed}
                required
              />
            </label>
            <label>
              Múi giờ
              <input
                name="timezone"
                defaultValue={task.timezone}
                maxLength={80}
                disabled={task.committed}
                required
                list="quest-timezones"
              />
              <datalist id="quest-timezones">
                <option value="Asia/Ho_Chi_Minh" />
                <option value="Asia/Tokyo" />
                <option value="UTC" />
                <option value="America/New_York" />
              </datalist>
            </label>
            <label>
              Kỹ năng
              <select name="skill" defaultValue={task.skill}>
                {Object.entries(skills).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kỹ năng luyện tập
              <SkillTargetSelect defaultValue={task.targetSkillId} />
            </label>
            <label>
              XP thưởng kỹ năng
              <input name="xpReward" type="number" min={1} max={1000000} step={1} defaultValue={task.xpReward ?? 100} required />
            </label>
            <label>
              Boss liên kết
              <select name="bossId" defaultValue={task.bossId ?? ""}>
                <option value="" disabled={!!task.bossId}>
                  Theo boss đang hoạt động
                </option>
                {state.bosses
                  .filter(
                    (boss) =>
                      (!boss.defeatedAt &&
                        (!task.campaignId || boss.campaignId === task.campaignId)) ||
                      boss.id === task.bossId,
                  )
                  .map((boss) => (
                    <option
                      key={boss.id}
                      value={boss.id}
                      disabled={!!boss.defeatedAt}
                    >
                      {BOSSES.find((def) => def.id === boss.definitionId)?.name ??
                        boss.definitionId}
                      {boss.defeatedAt ? " · đã đánh bại" : ""}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <label>
            Checklist · mỗi dòng một mục
            <textarea
              value={checklist}
              onChange={(event) => setChecklist(event.target.value)}
              rows={4}
              maxLength={3630}
            />
          </label>
          {checklistChanged && (
            <p className="quest-lock-note">
              Danh sách đã đổi: khi lưu, các mục checklist sẽ có ID mới và trạng thái chưa hoàn thành. Các trường khác không làm mất tiến độ checklist.
            </p>
          )}
          {!task.committed && (
            <label className="checkbox-label">
              <input type="checkbox" name="committed" />
              Cam kết theo luật hiện tại · bỏ lỡ có thể bị phạt trong Hardcore
            </label>
          )}
          {notice && (
            <p className="quest-form-alert" role="alert">
              {notice}
            </p>
          )}
          {sent && !busy && (
            <p className="quest-form-status" role="status">
              Yêu cầu đã được gửi. Nếu máy chủ từ chối, xem thông báo và sửa lại nội dung.
            </p>
          )}
          <div className="button-row">
            <button type="button" className="btn ghost" onClick={onClose}>
              Hủy chỉnh sửa
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              <Check size={15} />
              {busy ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default QuestManager;
