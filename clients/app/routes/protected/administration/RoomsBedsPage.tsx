import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Wrench, Bed } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

import { useCreateRoom, useReferenceDepartments, useRooms } from "@/hooks/administration/administration.hooks";
import { roomSchema, type RoomFormValues } from "@/schemas/administration.schema";
import type { Room, RoomType } from "@/services/administration/administration.api";
import { QueryError, QueryLoading } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { errorMessage } from "@/services/api/api-error";

const statusColors: Record<Room["status"], { bg: string; color: string; dot: string }> = {
  Available: { bg: "#dcfce7", color: "#16a34a", dot: "#16a34a" },
  Occupied: { bg: "#dbeafe", color: "#2563eb", dot: "#2563eb" },
  Maintenance: { bg: "#fef9c3", color: "#ca8a04", dot: "#d97706" },
  Reserved: { bg: "#ede9fe", color: "#7c3aed", dot: "#7c3aed" },
};

const typeColors: Record<RoomType, string> = {
  STANDARD: "#64748b",
  PRIVATE: "#2563eb",
  ICU: "#dc2626",
  EMERGENCY: "#d97706",
  ISOLATION: "#7c3aed",
};

const ROOM_TYPES: RoomType[] = ["STANDARD", "PRIVATE", "ICU", "EMERGENCY", "ISOLATION"];

export default function RoomsBedsPage() {
  const [activeFloor, setActiveFloor] = useState("");
  const [page, setPage] = useState(1);
  const [maintenanceOnly, setMaintenanceOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const rooms = useRooms({
    page,
    pageSize: 24,
    floor: activeFloor || undefined,
  });
  // Separate lightweight read for the floor tabs so filtering never hides them.
  const floorSource = useRooms({ page: 1, pageSize: 100 });
  const departments = useReferenceDepartments();
  const createRoom = useCreateRoom();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: { number: "", floor: "", type: "STANDARD", departmentId: "", bedCount: "" },
  });

  const summary = rooms.data?.summary;
  const floors = useMemo(
    () => Array.from(new Set((floorSource.data?.rows ?? []).map((room) => room.floor))).sort(),
    [floorSource.data],
  );

  const rows = useMemo(() => {
    const all = rooms.data?.rows ?? [];
    return maintenanceOnly ? all.filter((room) => room.status === "Maintenance") : all;
  }, [rooms.data, maintenanceOnly]);

  const totalBeds = summary?.totalBeds ?? 0;
  const occupiedBeds = summary?.occupiedBeds ?? 0;
  const availableBeds = summary?.availableBeds ?? 0;
  const occupancyRate = summary?.occupancyRate ?? 0;

  const statusCounts = { Available: 0, Occupied: 0, Maintenance: 0, Reserved: 0 };
  for (const room of rooms.data?.rows ?? []) statusCounts[room.status] += 1;
  const donutData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const donutColors = ["#16a34a", "#2563eb", "#d97706", "#7c3aed"];

  const onSubmit = async (values: RoomFormValues) => {
    try {
      await createRoom.mutateAsync({
        number: values.number,
        floor: values.floor,
        type: values.type,
        departmentId: values.departmentId || undefined,
        bedCount: values.bedCount ? Number(values.bedCount) : undefined,
      });
      toast.success("Room created");
      reset();
      setShowModal(false);
    } catch (error) {
      toast.error(errorMessage(error, "Could not create the room."));
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground mb-1">Rooms & Beds</h1>
          <p className="text-sm text-muted-foreground">Real-time room occupancy and bed management</p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => setMaintenanceOnly((value) => !value)}
            className={`flex items-center gap-1.5 px-4 py-2.5 border rounded-[10px] cursor-pointer font-semibold text-[13px] ${
              maintenanceOnly ? "bg-blue-600 text-white border-blue-600" : "bg-muted text-foreground border-border"
            }`}
          >
            <Wrench size={14} /> {maintenanceOnly ? "Showing Maintenance" : "Schedule Maintenance"}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white border-none rounded-[10px] cursor-pointer font-bold text-[13px]"
          >
            <Plus size={14} /> Add Room
          </button>
        </div>
      </div>

      {rooms.isLoading && <QueryLoading text="Loading rooms…" />}
      {rooms.isError && <QueryError error={rooms.error} onRetry={() => void rooms.refetch()} />}

      {!rooms.isLoading && !rooms.isError && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-6">
            <div className="lg:col-span-3 grid grid-cols-2 gap-3.5">
              {[
                { label: "Total Beds", value: totalBeds, color: "#2563eb", bg: "#dbeafe" },
                { label: "Occupied", value: occupiedBeds, color: "#dc2626", bg: "#fee2e2" },
                { label: "Available", value: availableBeds, color: "#16a34a", bg: "#dcfce7" },
                { label: "Occupancy Rate", value: `${occupancyRate}%`, color: occupancyRate > 85 ? "#dc2626" : "#d97706", bg: "#fef9c3" },
              ].map((s) => (
                <div key={s.label} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-[12px] flex items-center justify-center" style={{ backgroundColor: s.bg }}>
                    <Bed size={20} style={{ color: s.color }} />
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold text-foreground">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2">
              <h3 className="text-sm font-bold text-foreground mb-1">Room Status</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={donutData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={donutColors[i]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex gap-1 mb-4 bg-card border border-border rounded-xl p-1 w-fit">
            <button
              onClick={() => {
                setActiveFloor("");
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-[13px] font-semibold cursor-pointer border-none transition-colors ${
                activeFloor === "" ? "bg-blue-600 text-white" : "text-muted-foreground bg-transparent"
              }`}
            >
              All Floors
            </button>
            {floors.map((floor) => (
              <button
                key={floor}
                onClick={() => {
                  setActiveFloor(floor);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-lg text-[13px] font-semibold cursor-pointer border-none transition-colors ${
                  activeFloor === floor ? "bg-blue-600 text-white" : "text-muted-foreground bg-transparent"
                }`}
              >
                {floor}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {rows.map((room) => {
              const s = statusColors[room.status];
              return (
                <div key={room.id} className="bg-card rounded-[14px] p-4 relative" style={{ border: `2px solid ${s.dot}22` }}>
                  <div className="flex justify-between items-start mb-2.5">
                    <div>
                      <div className="text-xl font-extrabold text-foreground font-mono">Room {room.number}</div>
                      <span
                        className="text-[10px] font-bold px-[7px] py-0.5 rounded-full"
                        style={{ backgroundColor: `${typeColors[room.type]}22`, color: typeColors[room.type] }}
                      >
                        {room.type}
                      </span>
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full mt-1" style={{ backgroundColor: s.dot }} />
                  </div>
                  <div className="mb-2.5">
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                      <span>Beds: {room.occupied}/{room.beds}</span>
                      <span className="font-bold" style={{ color: s.color }}>{room.status}</span>
                    </div>
                    <div className="h-[5px] bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${room.beds > 0 ? (room.occupied / room.beds) * 100 : 0}%`,
                          backgroundColor: s.dot,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {room.patients.length > 0
                      ? room.patients.map((patient) => patient.name).join(", ")
                      : room.patient ?? "No patients"}
                  </div>
                </div>
              );
            })}
          </div>

          {rows.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">No rooms match this filter.</div>
          )}
          <ServerPager meta={rooms.data?.meta} onPageChange={setPage} />
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <form onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border rounded-[20px] p-8 w-[460px]">
            <h2 className="text-xl font-extrabold text-foreground mb-6">Add New Room</h2>

            <div className="mb-3.5">
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">Room Number</label>
              <input {...register("number")} placeholder="e.g. 204" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 box-border" />
              {errors.number && <p className="text-[11px] text-red-600 mt-1">{errors.number.message}</p>}
            </div>

            <div className="mb-3.5">
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">Floor</label>
              <input {...register("floor")} placeholder="e.g. Floor 2" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 box-border" />
              {errors.floor && <p className="text-[11px] text-red-600 mt-1">{errors.floor.message}</p>}
            </div>

            <div className="mb-3.5">
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">Room Type</label>
              <select {...register("type")} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 box-border">
                {ROOM_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="mb-3.5">
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">Department</label>
              <select {...register("departmentId")} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 box-border">
                <option value="">Unassigned</option>
                {(departments.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-3.5">
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">Beds</label>
              <input {...register("bedCount")} placeholder="e.g. 4" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 box-border" />
              {errors.bedCount && <p className="text-[11px] text-red-600 mt-1">{errors.bedCount.message}</p>}
            </div>

            <div className="flex gap-2.5 mt-5 justify-end">
              <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 bg-muted border border-border rounded-xl cursor-pointer font-semibold text-[13px] text-foreground">
                Cancel
              </button>
              <button type="submit" disabled={createRoom.isPending} className="px-5 py-2.5 bg-blue-600 text-white border-none rounded-xl cursor-pointer font-bold text-[13px] disabled:opacity-60">
                {createRoom.isPending ? "Saving…" : "Add Room"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
