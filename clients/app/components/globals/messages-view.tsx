import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { Search, Send, Paperclip, Phone, Video, MoreVertical, Plus } from "lucide-react";

import {
  useConversations,
  useConversationMessages,
  useMessagingDirectory,
  useSendMessage,
  useStartConversation,
} from "@/hooks/messaging/messaging.hooks";
import { useSession } from "@/hooks/auth/use-session";
import { QueryError, QueryLoading } from "@/components/globals/query-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/services/api/api-error";
import { formatDateTime, initialsOf, relativeTime } from "@/lib/format";

const AVATAR_COLORS = ["#2563eb", "#7c3aed", "#0891b2", "#16a34a", "#d97706", "#dc2626"];
const colorFor = (id: string) => AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

function NewConversationModal({ onClose }: { onClose: () => void }) {
  const directory = useMessagingDirectory();
  const startConversation = useStartConversation();
  const [selected, setSelected] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [search, setSearch] = useState("");

  const options = useMemo(() => {
    const staff = (directory.data?.staff ?? []).map((person) => ({
      id: person.id,
      label: `${person.name} · ${person.role}`,
      key: person.id,
    }));
    const patients = (directory.data?.patients ?? []).map((patient) => ({
      id: patient.userId ?? patient.id,
      label: `${patient.name} · ${patient.mrn}`,
      key: patient.id,
    }));
    return [...staff, ...patients].filter((option) =>
      option.label.toLowerCase().includes(search.toLowerCase()),
    );
  }, [directory.data, search]);

  const create = async () => {
    if (selected.length === 0) {
      toast.error("Pick at least one recipient.");
      return;
    }
    try {
      await startConversation.mutateAsync({
        participantIds: selected,
        subject: subject || undefined,
      });
      toast.success("Conversation started");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not start the conversation."));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
      <div className="bg-card rounded-[20px] p-8 w-[480px] shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-extrabold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">New Conversation</h2>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-muted-foreground text-[22px]">×</button>
        </div>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (optional)"
          className="w-full py-2.5 px-3 mb-3 rounded-[10px] border border-border bg-background text-foreground text-sm box-border"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people…"
          className="w-full py-2.5 px-3 mb-3 rounded-[10px] border border-border bg-background text-foreground text-sm box-border"
        />
        <div className="max-h-52 overflow-y-auto border border-border rounded-[10px] p-2 flex flex-col gap-1">
          {directory.isLoading && <div className="text-xs text-muted-foreground px-2 py-1">Loading directory…</div>}
          {options.map((option) => (
            <label key={option.key} className="flex items-center gap-2 text-[13px] text-foreground px-1.5 py-1 rounded cursor-pointer hover:bg-muted">
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={() =>
                  setSelected((prev) =>
                    prev.includes(option.id) ? prev.filter((id) => id !== option.id) : [...prev, option.id],
                  )
                }
              />
              {option.label}
            </label>
          ))}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-3 rounded-[10px] border border-border bg-muted text-foreground font-semibold cursor-pointer text-sm">Cancel</button>
          <button onClick={() => void create()} disabled={startConversation.isPending} className="flex-1 py-3 rounded-[10px] border-none bg-blue-600 text-white font-bold cursor-pointer text-sm disabled:opacity-60">
            {startConversation.isPending ? "Starting…" : "Start"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Shared messaging screen for every role. Conversations, threads and sends come
 * from `messagingApi`; only the selected thread stays in local state.
 */
export default function MessagesView() {
  const [searchParams] = useSearchParams();
  const { data: session } = useSession();
  const conversations = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const sendMessage = useSendMessage();

  const list = conversations.data ?? [];
  const debouncedSearch = useDebouncedValue(search);
  const filtered = list.filter((conversation) => {
    const label = conversation.subject ?? conversation.patientName ?? conversation.type;
    return label.toLowerCase().includes(debouncedSearch.toLowerCase());
  });

  useEffect(() => {
    const requested = searchParams.get("conversationId");
    if (requested) setActiveId(requested);
    else if (!activeId && list.length > 0) setActiveId(list[0].id);
  }, [searchParams, list, activeId]);

  const active = list.find((conversation) => conversation.id === activeId) ?? null;
  const messages = useConversationMessages(activeId);

  const counterpart = (conversationId: string, name: string | null, type: string) => {
    if (name) return name;
    const conversation = list.find((entry) => entry.id === conversationId);
    const others = (conversation?.participants ?? []).filter((p) => p.id !== session?.id);
    return others.map((p) => p.name).join(", ") || type;
  };

  const title = active ? counterpart(active.id, active.patientName ?? active.subject, active.type) : "Messages";
  const rows = [...(messages.data?.rows ?? [])].reverse();

  const submit = async () => {
    if (!activeId || !draft.trim()) return;
    try {
      await sendMessage.mutateAsync({ conversationId: activeId, body: draft.trim() });
      setDraft("");
    } catch (error) {
      toast.error(errorMessage(error, "Could not send the message."));
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-background">
      {showNew && <NewConversationModal onClose={() => setShowNew(false)} />}

      {/* Sidebar */}
      <div className="w-[320px] shrink-0 bg-card border-r border-border flex flex-col">
        <div className="pt-5 px-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-extrabold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">Messages</h2>
            <button onClick={() => setShowNew(true)} className="flex items-center gap-1 py-1.5 px-2.5 bg-blue-600 text-white border-none rounded-lg text-[11px] font-bold cursor-pointer">
              <Plus size={12} /> New
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full py-2 pl-8 pr-3 rounded-lg border border-border text-[13px] bg-muted text-foreground outline-none box-border"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.isLoading && <div className="text-xs text-muted-foreground text-center py-4">Loading…</div>}
          {conversations.isError && (
            <QueryError error={conversations.error} onRetry={() => void conversations.refetch()} className="py-4" />
          )}
          {!conversations.isLoading && filtered.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-6 px-4">
              No conversations yet. Start one to message a colleague or patient.
            </div>
          )}
          {filtered.map((conversation) => {
            const label = counterpart(conversation.id, conversation.patientName ?? conversation.subject, conversation.type);
            const color = colorFor(conversation.id);
            return (
              <button
                key={conversation.id}
                onClick={() => setActiveId(conversation.id)}
                className="w-full px-4 py-3.5 flex gap-3 items-start border-none cursor-pointer text-left transition-colors"
                style={{
                  background: activeId === conversation.id ? "var(--accent)" : "transparent",
                  borderLeft: `3px solid ${activeId === conversation.id ? color : "transparent"}`,
                }}
              >
                <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0" style={{ background: color }}>
                  {initialsOf(label)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-0.5 gap-2">
                    <span className="text-[13px] font-bold text-foreground truncate">{label}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{relativeTime(conversation.lastMessageAt)}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mb-1">{conversation.type}</div>
                  <div className="text-xs text-muted-foreground truncate">{conversation.lastMessage ?? "No messages yet"}</div>
                </div>
                {conversation.unreadCount > 0 && (
                  <div className="min-w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    {conversation.unreadCount}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {!active && (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <p className="text-base font-semibold">Select a conversation</p>
          </div>
        )}

        {active && (
          <>
            <div className="py-3.5 px-6 bg-card border-b border-border flex items-center gap-3">
              <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-white text-[13px] font-bold" style={{ background: colorFor(active.id) }}>
                {initialsOf(title)}
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-bold text-foreground">{title}</div>
                <div className="text-xs text-muted-foreground font-medium">
                  {(active.participants ?? []).map((participant) => `${participant.name} (${participant.role})`).join(" · ") || active.type}
                </div>
              </div>
              <div className="flex gap-2">
                {[Phone, Video, MoreVertical].map((Icon, index) => (
                  <button key={index} className="w-9 h-9 rounded-lg border border-border bg-transparent cursor-pointer flex items-center justify-center text-muted-foreground">
                    <Icon size={16} />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              {messages.isLoading && <QueryLoading text="Loading messages…" />}
              {messages.isError && <QueryError error={messages.error} onRetry={() => void messages.refetch()} />}
              {!messages.isLoading && rows.length === 0 && (
                <div className="text-center text-[13px] text-muted-foreground py-6">No messages in this conversation yet.</div>
              )}
              {rows.map((message) => {
                const mine = message.senderId === session?.id;
                return (
                  <div key={message.id} className={`flex gap-2.5 ${mine ? "justify-end" : "justify-start"}`}>
                    {!mine && (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-auto"
                        style={{ background: colorFor(active.id) }}
                      >
                        {initialsOf(message.senderName)}
                      </div>
                    )}
                    <div className="max-w-[65%]">
                      <div
                        className="py-3 px-4 text-sm leading-relaxed"
                        style={{
                          borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                          background: mine ? "#2563eb" : "var(--card)",
                          color: mine ? "white" : "var(--foreground)",
                          border: mine ? "none" : "1px solid var(--border)",
                        }}
                      >
                        {message.body}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                        <span className="text-[11px] text-muted-foreground">
                          {!mine ? `${message.senderName} · ` : ""}
                          {formatDateTime(message.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 px-6 bg-card border-t border-border">
              <div className="flex gap-3 items-end">
                <button className="p-2.5 border border-border rounded-lg bg-transparent cursor-pointer text-muted-foreground flex">
                  <Paperclip size={18} />
                </button>
                <div className="flex-1">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submit();
                      }
                    }}
                    placeholder={`Message ${title}...`}
                    rows={1}
                    className="w-full py-2.5 px-4 border-[1.5px] border-border rounded-xl text-sm bg-muted text-foreground outline-none resize-none box-border focus:border-blue-600"
                  />
                </div>
                <button
                  onClick={() => void submit()}
                  disabled={!draft.trim() || sendMessage.isPending}
                  className={`py-2.5 px-[18px] border-none rounded-[10px] flex items-center gap-1.5 text-[13px] font-semibold transition-all ${
                    draft.trim() && !sendMessage.isPending
                      ? "bg-blue-600 text-white cursor-pointer"
                      : "bg-muted text-muted-foreground cursor-default"
                  }`}
                >
                  <Send size={15} /> {sendMessage.isPending ? "Sending…" : "Send"}
                </button>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground text-center">
                🔒 Encrypted · HIPAA compliant messaging · Press Enter to send
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
