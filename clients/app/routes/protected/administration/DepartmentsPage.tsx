import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Users, Bed } from "lucide-react";

import { useCreateDepartment, useDepartments, useDoctors } from "@/hooks/administration/administration.hooks";
import { departmentSchema, type DepartmentFormValues } from "@/schemas/administration.schema";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/globals/query-state";
import { errorMessage } from "@/services/api/api-error";

const statusStyles: Record<string, { bg: string; text: string }> = {
  "High Volume": { bg: "#fee2e2", text: "#dc2626" },
  "Under Maintenance": { bg: "#fef9c3", text: "#ca8a04" },
  Operational: { bg: "#dcfce7", text: "#16a34a" },
};

export default function DepartmentsPage() {
  const [showModal, setShowModal] = useState(false);
  const departments = useDepartments({ pageSize: 100 });
  const doctors = useDoctors({ pageSize: 100, status: "ACTIVE" });
  const createDepartment = useCreateDepartment();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: "", code: "", floor: "", location: "", headDoctorId: "", bedCapacity: "" },
  });

  const rows = useMemo(() => departments.data?.rows ?? [], [departments.data]);

  const onSubmit = async (values: DepartmentFormValues) => {
    try {
      await createDepartment.mutateAsync({
        name: values.name,
        code: values.code || undefined,
        floor: values.floor || undefined,
        location: values.location || undefined,
        headDoctorId: values.headDoctorId || undefined,
        bedCapacity: values.bedCapacity ? Number(values.bedCapacity) : undefined,
      });
      toast.success("Department created");
      reset();
      setShowModal(false);
    } catch (error) {
      toast.error(errorMessage(error, "Could not create the department."));
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground mb-1">Departments</h1>
          <p className="text-sm text-muted-foreground">Manage hospital departments, staff, and capacity</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white border-none rounded-xl cursor-pointer font-bold text-sm hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Add Department
        </button>
      </div>

      {departments.isLoading && <QueryLoading text="Loading departments…" />}
      {departments.isError && (
        <QueryError error={departments.error} onRetry={() => void departments.refetch()} />
      )}

      {departments.data && rows.length === 0 && (
        <QueryEmpty title="No departments yet" description="Add the first department to get started." />
      )}

      {/* Department Cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((dept) => {
            const occupancy = dept.bedCount > 0 ? Math.round((dept.bedsOccupied / dept.bedCount) * 100) : 0;
            const sc = statusStyles[dept.status] ?? statusStyles.Operational;
            return (
              <div key={dept.id} className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-[15px] font-extrabold text-foreground">{dept.name}</div>
                    <div className="text-xs text-muted-foreground">Head: {dept.head ?? "Unassigned"}</div>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: sc.bg, color: sc.text }}>
                    {dept.status}
                  </span>
                </div>
                <div className="flex gap-4 mb-3">
                  <div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Users size={10} /> Staff</div>
                    <div className="text-base font-extrabold text-blue-600">{dept.staffCount}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Bed size={10} /> Beds</div>
                    <div className="text-base font-extrabold text-foreground">{dept.bedsOccupied}/{dept.bedCount}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Occupancy</div>
                    <div className="text-base font-extrabold" style={{ color: occupancy > 80 ? "#dc2626" : "#16a34a" }}>{occupancy}%</div>
                  </div>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${occupancy}%`, backgroundColor: occupancy > 85 ? "#dc2626" : occupancy > 70 ? "#d97706" : "#16a34a" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="bg-card border border-border rounded-[20px] p-8 w-[480px]"
          >
            <h2 className="text-xl font-extrabold text-foreground mb-6">Add New Department</h2>

            <div className="mb-3.5">
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">Department Name</label>
              <input
                {...register("name")}
                placeholder="e.g. Cardiology"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 transition-colors box-border"
              />
              {errors.name && <p className="text-[11px] text-red-600 mt-1">{errors.name.message}</p>}
            </div>

            <div className="mb-3.5">
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">Department Head</label>
              <select
                {...register("headDoctorId")}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 transition-colors box-border"
              >
                <option value="">Unassigned</option>
                {(doctors.data?.rows ?? []).map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-3.5">
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">Floor</label>
              <input
                {...register("floor")}
                placeholder="e.g. Floor 3"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 transition-colors box-border"
              />
            </div>

            <div className="mb-3.5">
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">Bed Capacity</label>
              <input
                {...register("bedCapacity")}
                placeholder="e.g. 24"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 transition-colors box-border"
              />
              {errors.bedCapacity && <p className="text-[11px] text-red-600 mt-1">{errors.bedCapacity.message}</p>}
            </div>

            <div className="flex gap-2.5 mt-5 justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 bg-muted border border-border rounded-xl cursor-pointer font-semibold text-[13px] text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || createDepartment.isPending}
                className="px-5 py-2.5 bg-blue-600 text-white border-none rounded-xl cursor-pointer font-bold text-[13px] disabled:opacity-60"
              >
                {createDepartment.isPending ? "Saving…" : "Add Department"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
