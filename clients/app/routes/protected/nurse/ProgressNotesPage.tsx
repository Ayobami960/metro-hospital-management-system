import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Save, FileText, Clock, User, ChevronRight } from "lucide-react";

import { useAssignedPatients, useCreateNote, usePatientNotes } from "@/hooks/nursing/nursing.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, formatDateTime, isoDate, label as toLabel } from "@/lib/format";

/** Section prompts for each supported note type — UI copy, not server data. */
const TEMPLATES = {
  SOAP: "S:\n\nO:\n\nA:\n\nP:",
  DAR: "Data:\n\nAction:\n\nResponse:",
  NARRATIVE: "",
} as const;

type NoteKind = keyof typeof TEMPLATES;

const typeColors: Record<string, { bg: string; color: string }> = {
  SOAP: { bg: "#dbeafe", color: "#2563eb" },
  DAR: { bg: "#ede9fe", color: "#7c3aed" },
  NARRATIVE: { bg: "#fef9c3", color: "#d97706" },
  PROGRESS: { bg: "#cffafe", color: "#0891b2" },
  CONSULT: { bg: "#dcfce7", color: "#16a34a" },
};

export default function ProgressNotesPage() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [noteType, setNoteType] = useState<NoteKind>("SOAP");
  const [noteContent, setNoteContent] = useState<string>(TEMPLATES.SOAP);
  const [page, setPage] = useState(1);

  const patients = useAssignedPatients({ pageSize: 50 });
  const list = patients.data?.rows ?? [];
  const selectedPatient = list.find((patient) => patient.id === selectedPatientId) ?? list[0] ?? null;
  const notes = usePatientNotes(selectedPatient?.id, { page, pageSize: 10 });
  const createNote = useCreateNote();

  const patientNotes = useMemo(() => notes.data?.rows ?? [], [notes.data]);

  const save = async () => {
    if (!selectedPatient) return;
    if (noteContent.replace(/(S|O|A|P|Data|Action|Response):/gi, "").trim().length === 0) {
      toast.error("Write the note before signing it.");
      return;
    }
    try {
      await createNote.mutateAsync({
        patientId: selectedPatient.id,
        title: `${toLabel(noteType)} Note — ${formatDate(isoDate())}`,
        content: noteContent,
        type: noteType,
      });
      toast.success("Note signed and saved");
      setNoteContent(TEMPLATES[noteType]);
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the note."));
    }
  };

  if (patients.isLoading) {
    return (
      <div className="p-6">
        <QueryLoading text="Loading your patients…" />
      </div>
    );
  }

  if (patients.isError) {
    return (
      <div className="p-6">
        <QueryError error={patients.error} onRetry={() => void patients.refetch()} />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Progress Notes</h1>
        <p className="text-muted-foreground text-[15px]">Clinical documentation · {formatDate(isoDate())}</p>
      </div>

      <div className="grid gap-5 items-start" style={{ gridTemplateColumns: "260px 1fr" }}>
        {/* Patient List */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="text-sm font-bold text-foreground mb-3.5 font-['Plus_Jakarta_Sans',sans-serif]">Patients</div>
          <div className="flex flex-col gap-1.5">
            {list.map((patient) => {
              const isSelected = selectedPatient?.id === patient.id;
              return (
                <div
                  key={patient.id}
                  onClick={() => {
                    setSelectedPatientId(patient.id);
                    setPage(1);
                  }}
                  className="py-2.5 px-3 rounded-[10px] cursor-pointer border-[1.5px] transition-all duration-150 flex justify-between items-center"
                  style={{ borderColor: isSelected ? "#0891b2" : "transparent", background: isSelected ? "#cffafe" : "var(--muted)" }}
                >
                  <div>
                    <div className="text-[13px] font-bold" style={{ color: isSelected ? "#0891b2" : "var(--foreground)" }}>
                      {patient.firstName} {patient.lastName}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">{patient.mrn}</div>
                  </div>
                  <ChevronRight size={12} color={isSelected ? "#0891b2" : "var(--muted-foreground)"} />
                </div>
              );
            })}
            {list.length === 0 && <InlineEmpty text="No patients assigned." />}
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex flex-col gap-4">
          {/* Note Editor */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="text-base font-bold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">
                New Note{selectedPatient ? ` — ${selectedPatient.firstName} ${selectedPatient.lastName}` : ""}
              </div>
              {selectedPatient && (
                <div className="text-xs text-muted-foreground font-mono">
                  {selectedPatient.mrn} · {selectedPatient.age} yrs
                </div>
              )}
            </div>

            {/* Template Selector */}
            <div className="mb-3.5">
              <label className="block text-xs font-semibold text-foreground mb-1.5">Note Template</label>
              <div className="flex gap-2">
                {(Object.keys(TEMPLATES) as NoteKind[]).map((type) => {
                  const colors = typeColors[type];
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        setNoteType(type);
                        setNoteContent(TEMPLATES[type]);
                      }}
                      className="py-2 px-[18px] rounded-lg text-[13px] font-bold border-[1.5px] cursor-pointer transition-all duration-150"
                      style={{
                        background: noteType === type ? colors.color : "var(--card)",
                        color: noteType === type ? "white" : colors.color,
                        borderColor: colors.color,
                      }}
                    >
                      {toLabel(type)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Note Content */}
            <div className="mb-4">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="w-full py-[9px] px-3 border-[1.5px] border-border rounded-lg text-[13px] bg-card text-foreground outline-none box-border min-h-[220px] resize-y font-['Inter',sans-serif] leading-relaxed"
              />
            </div>

            {/* Save Buttons */}
            <div className="flex gap-2.5">
              <button
                onClick={() => void save()}
                disabled={!selectedPatient || createNote.isPending}
                className="flex items-center gap-2 py-[11px] px-6 text-white border-none rounded-[10px] text-sm font-bold cursor-pointer transition-colors duration-200 bg-cyan-600 disabled:opacity-60"
              >
                <Save size={16} /> {createNote.isPending ? "Saving…" : "Save & Sign Note"}
              </button>
              <button
                onClick={() => setNoteContent(TEMPLATES[noteType])}
                className="py-[11px] px-[18px] bg-muted text-foreground border-[1.5px] border-border rounded-[10px] text-[13px] font-semibold cursor-pointer"
              >
                Reset Template
              </button>
            </div>
          </div>

          {/* Notes Timeline */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="text-base font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">
              Notes Timeline{selectedPatient ? ` — ${selectedPatient.firstName} ${selectedPatient.lastName}` : ""}
            </div>
            {notes.isLoading && <QueryLoading text="Loading notes…" />}
            {notes.isError && <QueryError error={notes.error} onRetry={() => void notes.refetch()} />}
            {!notes.isLoading && !notes.isError && patientNotes.length === 0 && (
              <div className="text-center py-[30px] text-muted-foreground text-sm">No notes yet for this patient.</div>
            )}
            {!notes.isLoading && !notes.isError && patientNotes.length > 0 && (
              <>
                <div className="flex flex-col gap-4">
                  {patientNotes.map((note, index) => {
                    const colors = typeColors[note.type] ?? typeColors.PROGRESS;
                    return (
                      <div key={note.id} className="flex gap-3.5">
                        <div className="flex flex-col items-center shrink-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
                            <FileText size={14} color={colors.color} />
                          </div>
                          {index < patientNotes.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1" />}
                        </div>
                        <div className="flex-1" style={{ paddingBottom: index < patientNotes.length - 1 ? 16 : 0 }}>
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.bg, color: colors.color }}>
                              {toLabel(note.type)}
                            </span>
                            <div className="flex items-center gap-1 text-muted-foreground text-xs">
                              <User size={11} /> {note.signedBy ? "Signed" : "Drafted"}
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground text-xs">
                              <Clock size={11} /> {formatDateTime(note.createdAt)}
                            </div>
                            {note.status !== "SIGNED" && (
                              <span className="text-[11px] text-amber-600 font-semibold">{toLabel(note.status)}</span>
                            )}
                          </div>
                          <div className="py-3 px-3.5 bg-muted rounded-lg text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">
                            {note.title && <div className="font-bold mb-1">{note.title}</div>}
                            {note.content.length > 600 ? `${note.content.slice(0, 600)}…` : note.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <ServerPager meta={notes.data?.meta} onPageChange={setPage} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
