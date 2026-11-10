import { useState } from "react";
import { Bed, AlertTriangle, Activity, UserMinus, Heart } from "lucide-react";

import { useWardOverview } from "@/hooks/nursing/nursing.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { formatDateTime, initialsOf, label as toLabel } from "@/lib/format";
import type { WardRoom } from "@/services/nursing/nursing.api";

const statusConfig: Record<string, { bg: string; border: string; color: string; label: string }> = {
  Available: { bg: "#f0fdf4", border: "#86efac", color: "#16a34a", label: "Available" },
  Occupied: { bg: "#dbeafe", border: "#93c5fd", color: "#2563eb", label: "Occupied" },
  Maintenance: { bg: "#fef9c3", border: "#fde047", color: "#d97706", label: "Maintenance" },
};

function RoomCard({ room }: { room: WardRoom }) {
  const style = statusConfig[room.status] ?? statusConfig.Available;
  return (
    <div className="p-3 rounded-[10px] min-h-[90px]" style={{ border: `1.5px solid ${style.border}`, backgroundColor: style.bg }}>
      <div className="flex justify-between items-start mb-1.5">
        <span className="text-xs font-extrabold font-mono" style={{ color: style.color }}>
          {room.number}
        </span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: style.color, backgroundColor: "white" }}>
          {style.label}
        </span>
      </div>
      <div className="text-xs font-bold text-slate-800 leading-tight">{room.department ?? room.type}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{room.bedCount} beds · Floor {room.floor}</div>
      <div className="text-[10px] mt-1 font-semibold" style={{ color: style.color }}>
        {room.occupied} occupied · {room.available} free
        {room.maintenance > 0 ? ` · ${room.maintenance} maint.` : ""}
      </div>
    </div>
  );
}

export default function WardOverviewPage() {
  const overview = useWardOverview();
  const [floor, setFloor] = useState<string>("All");

  if (overview.isLoading) {
    return (
      <div className="p-6">
        <QueryLoading text="Loading the ward map…" />
      </div>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <div className="p-6">
        <QueryError error={overview.error} onRetry={() => void overview.refetch()} />
      </div>
    );
  }

  const { beds, rooms, patients } = overview.data;
  const floors = Array.from(new Set(rooms.map((room) => room.floor))).sort();
  const displayRooms = floor === "All" ? rooms : rooms.filter((room) => room.floor === floor);
  const singleFloor = floor !== "All";

  const stats = [
    { label: "Total Beds", value: beds.total, icon: Bed, color: "#6b7280", bg: "#f3f4f6" },
    { label: "Occupied", value: beds.occupied, icon: Activity, color: "#2563eb", bg: "#dbeafe" },
    { label: "Available", value: beds.available, icon: Bed, color: "#16a34a", bg: "#dcfce7" },
    { label: "Reserved", value: beds.reserved, icon: UserMinus, color: "#d97706", bg: "#fef9c3" },
    { label: "Maintenance", value: beds.maintenance + beds.cleaning, icon: AlertTriangle, color: "#dc2626", bg: "#fee2e2" },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Ward Overview</h1>
        <p className="text-muted-foreground text-[15px]">
          {floors.length > 0 ? `Floors ${floors.join(", ")}` : "No floors configured"} · {patients.length} inpatients
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-6 flex items-center gap-3">
              <div className="w-[42px] h-[42px] rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: s.bg }}>
                <Icon size={18} color={s.color} />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-foreground font-mono">{s.value}</div>
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 300px" }}>
        {/* Floor Map */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="text-base font-bold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">Floor Map</div>
            <div className="flex gap-1.5">
              {["All", ...floors].map((option) => (
                <button
                  key={option}
                  onClick={() => setFloor(option)}
                  className="py-1.5 px-3.5 rounded-lg text-xs font-bold border-[1.5px] cursor-pointer"
                  style={{
                    background: floor === option ? "#0891b2" : "var(--card)",
                    color: floor === option ? "white" : "var(--foreground)",
                    borderColor: floor === option ? "#0891b2" : "var(--border)",
                  }}
                >
                  {option === "All" ? "All Floors" : `Floor ${option}`}
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 mb-4 flex-wrap">
            {Object.entries(statusConfig).map(([key, style]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: style.bg, border: `1.5px solid ${style.border}` }} />
                <span className="text-[11px] text-muted-foreground font-medium">{style.label}</span>
              </div>
            ))}
          </div>

          {displayRooms.length === 0 && <InlineEmpty text="No rooms configured for this floor." />}

          {singleFloor ? (
            <div className="grid grid-cols-4 gap-2.5">
              {displayRooms.map((room) => (
                <RoomCard key={room.roomId} room={room} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {floors.map((floorValue) => (
                <div key={floorValue}>
                  <div className="text-[13px] font-bold text-muted-foreground mb-2.5 flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    FLOOR {floorValue}
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="grid grid-cols-5 gap-2.5">
                    {rooms
                      .filter((room) => room.floor === floorValue)
                      .map((room) => (
                        <RoomCard key={room.roomId} room={room} />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inpatients */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="text-base font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Current Inpatients</div>
          <div className="flex flex-col gap-3">
            {patients.map((patient) => {
              const critical = patient.acuity === "CRITICAL" || patient.acuity === "HIGH";
              return (
                <div key={patient.id} className="flex gap-3">
                  <div
                    className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ backgroundColor: critical ? "#fee2e2" : "#dbeafe", color: critical ? "#dc2626" : "#2563eb" }}
                  >
                    {critical ? <AlertTriangle size={13} /> : initialsOf(patient.name)}
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-bold text-foreground leading-snug">{patient.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {patient.bed ? `Bed ${patient.bed}` : "No bed"} · {patient.age} yrs · {toLabel(patient.acuity)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Heart size={10} />
                      {patient.doctorName ?? "Unassigned doctor"}
                      {patient.admittedAt ? ` · ${formatDateTime(patient.admittedAt)}` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
            {patients.length === 0 && <InlineEmpty text="No inpatients recorded." />}
          </div>
        </div>
      </div>
    </div>
  );
}
