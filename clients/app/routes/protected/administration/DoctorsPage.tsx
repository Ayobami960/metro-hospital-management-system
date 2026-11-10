import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Search,
  Plus,
  X,
  Stethoscope,
  UserCheck,
  UserMinus,
  UserX,
  Eye,
  Edit2,
} from "lucide-react";

import {
  useCreateDoctor,
  useDoctors,
  useReferenceDepartments,
  useReferenceSpecialties,
  useUpdateDoctor,
} from "@/hooks/administration/administration.hooks";
import { doctorSchema, type DoctorFormValues } from "@/schemas/administration.schema";
import type { Doctor } from "@/services/administration/administration.api";
import { QueryError, QueryLoading } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/services/api/api-error";
import { label as toLabel } from "@/lib/format";

const avatarColors = ["#2563eb", "#7c3aed", "#0891b2", "#16a34a", "#d97706", "#dc2626", "#0d9488", "#9333ea"];

const statusStyles: Record<string, { bg: string; text: string }> = {
  ACTIVE: { bg: "#dcfce7", text: "#16a34a" },
  ON_LEAVE: { bg: "#fef9c3", text: "#ca8a04" },
  INACTIVE: { bg: "#fee2e2", text: "#dc2626" },
};

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On Leave" },
  { value: "INACTIVE", label: "Inactive" },
];

const EMPTY_FORM: DoctorFormValues = {
  name: "",
  email: "",
  phone: "",
  licenseNumber: "",
  licenseExpiry: "",
  departmentId: "",
  specialtyId: "",
  consultationFee: "",
  credentials: "",
  bio: "",
};

export default function DoctorsPage() {
  const [search, setSearch] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const [modalDoctor, setModalDoctor] = useState<Doctor | "new" | null>(null);

  // Server-side search/filter/pagination: the query key carries the params.
  const debouncedSearch = useDebouncedValue(search);
  const doctors = useDoctors({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
    specialtyId: filterSpecialty || undefined,
    status: filterStatus || undefined,
  });
  const specialties = useReferenceSpecialties();
  const departments = useReferenceDepartments();
  const createDoctor = useCreateDoctor();
  const updateDoctor = useUpdateDoctor();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorSchema),
    defaultValues: EMPTY_FORM,
  });

  const rows = doctors.data?.rows ?? [];
  const meta = doctors.data?.meta;

  const openCreate = () => {
    reset(EMPTY_FORM);
    setModalDoctor("new");
  };

  const openEdit = (doctor: Doctor) => {
    reset({
      name: doctor.name,
      email: doctor.email,
      phone: doctor.phone ?? "",
      licenseNumber: doctor.license,
      licenseExpiry: doctor.licenseExpiry ? doctor.licenseExpiry.slice(0, 10) : "",
      departmentId: doctor.departmentId ?? "",
      specialtyId: doctor.specialtyId ?? "",
      consultationFee: doctor.consultationFeeMinor
        ? (doctor.consultationFeeMinor / 100).toFixed(2)
        : "",
      credentials: doctor.credentials ?? "",
      bio: doctor.bio ?? "",
    });
    setModalDoctor(doctor);
  };

  const onSubmit = async (values: DoctorFormValues) => {
    const payload = {
      name: values.name,
      phone: values.phone || undefined,
      licenseNumber: values.licenseNumber,
      licenseExpiry: values.licenseExpiry || undefined,
      departmentId: values.departmentId || undefined,
      specialtyId: values.specialtyId || undefined,
      consultationFeeMinor: values.consultationFee
        ? Math.round(Number(values.consultationFee) * 100)
        : undefined,
      credentials: values.credentials || undefined,
      bio: values.bio || undefined,
    };

    try {
      if (modalDoctor === "new") {
        await createDoctor.mutateAsync({ ...payload, email: values.email });
        toast.success("Doctor added");
      } else if (modalDoctor) {
        await updateDoctor.mutateAsync({ doctorId: modalDoctor.id, input: payload });
        toast.success("Doctor updated");
      }
      setModalDoctor(null);
      reset(EMPTY_FORM);
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the doctor."));
    }
  };

  const deactivate = async (doctor: Doctor) => {
    if (!window.confirm(`Deactivate ${doctor.name}? They will lose access to the portal.`)) return;
    try {
      await updateDoctor.mutateAsync({ doctorId: doctor.id, input: { status: "INACTIVE" } });
      toast.success("Doctor deactivated");
    } catch (error) {
      toast.error(errorMessage(error, "Could not deactivate the doctor."));
    }
  };

  const statusCount = (status: string) => rows.filter((row) => row.status === status).length;
  const stats = [
    { label: "Total Doctors", value: meta?.total ?? rows.length, icon: Stethoscope, color: "#2563eb", bg: "#dbeafe" },
    { label: "Active", value: statusCount("ACTIVE"), icon: UserCheck, color: "#16a34a", bg: "#dcfce7" },
    { label: "On Leave", value: statusCount("ON_LEAVE"), icon: UserMinus, color: "#d97706", bg: "#fef9c3" },
    { label: "Inactive", value: statusCount("INACTIVE"), icon: UserX, color: "#dc2626", bg: "#fee2e2" },
  ];

  const saving = createDoctor.isPending || updateDoctor.isPending;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground mb-1">Doctor Management</h1>
          <p className="text-sm text-muted-foreground">Manage physician profiles, credentials, and status</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white border-none rounded-xl cursor-pointer font-bold text-sm hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Add Doctor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.bg }}>
                <Icon size={20} style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-4 flex gap-3 items-center">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or license..."
            className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 transition-colors"
          />
        </div>
        <select
          value={filterSpecialty}
          onChange={(e) => {
            setFilterSpecialty(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-muted border border-border rounded-lg text-[13px] text-foreground cursor-pointer"
        >
          <option value="">All Specialties</option>
          {(specialties.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-muted border border-border rounded-lg text-[13px] text-foreground cursor-pointer"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl p-5">
        {doctors.isLoading && <QueryLoading text="Loading doctors…" />}
        {doctors.isError && <QueryError error={doctors.error} onRetry={() => void doctors.refetch()} />}

        {!doctors.isLoading && !doctors.isError && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-2 border-border">
                  {["Doctor", "Specialty", "Department", "License #", "Status", "Patients", "Actions"].map((h) => (
                    <th key={h} className="text-left py-2 px-3.5 text-xs font-bold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((doc, i) => {
                  const style = statusStyles[doc.status] ?? statusStyles.INACTIVE;
                  return (
                    <tr key={doc.id} className="border-b border-border">
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold text-white shrink-0"
                            style={{ backgroundColor: avatarColors[i % avatarColors.length] }}
                          >
                            {doc.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-foreground">{doc.name}</div>
                            <div className="text-[11px] text-muted-foreground">{doc.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 text-muted-foreground">{doc.specialty ?? "—"}</td>
                      <td className="py-3.5 px-3.5 text-muted-foreground">{doc.department ?? "—"}</td>
                      <td className="py-3.5 px-3.5 font-mono text-xs text-foreground">{doc.license}</td>
                      <td className="py-3.5 px-3.5">
                        <span
                          className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                          style={{ backgroundColor: style.bg, color: style.text }}
                        >
                          {toLabel(doc.status)}
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5 font-mono font-bold text-foreground">{doc.patients}</td>
                      <td className="py-3.5 px-3.5">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => openEdit(doc)}
                            title="View Profile"
                            className="px-2 py-1.5 bg-blue-100 text-blue-600 border-none rounded-md cursor-pointer flex items-center gap-1 text-[11px] font-semibold hover:bg-blue-200 transition-colors"
                          >
                            <Eye size={12} /> View
                          </button>
                          <button
                            onClick={() => openEdit(doc)}
                            title="Edit"
                            className="px-2 py-1.5 bg-muted text-foreground border border-border rounded-md cursor-pointer flex items-center gap-1 text-[11px] font-semibold hover:bg-accent transition-colors"
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                          <button
                            onClick={() => void deactivate(doc)}
                            disabled={doc.status === "INACTIVE" || updateDoctor.isPending}
                            title="Deactivate"
                            className="px-2 py-1.5 bg-red-100 text-red-600 border-none rounded-md cursor-pointer flex items-center gap-1 text-[11px] font-semibold hover:bg-red-200 transition-colors disabled:opacity-40"
                          >
                            <UserX size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">No doctors match your search criteria.</div>
            )}
          </div>
        )}
        <ServerPager meta={meta} onPageChange={setPage} />
      </div>

      {/* Modal */}
      {modalDoctor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="bg-card border border-border rounded-[20px] p-8 w-[520px] max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-foreground">
                {modalDoctor === "new" ? "Add New Doctor" : "Edit Doctor"}
              </h2>
              <button type="button" onClick={() => setModalDoctor(null)} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">Full Name</label>
                <input {...register("name")} placeholder="Dr. First Last" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 transition-colors box-border" />
                {errors.name && <p className="text-[11px] text-red-600 mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">Email</label>
                <input {...register("email")} disabled={modalDoctor !== "new"} placeholder="doctor@medicore.com" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 transition-colors box-border disabled:opacity-70" />
                {errors.email && <p className="text-[11px] text-red-600 mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">Phone</label>
                <input {...register("phone")} placeholder="(555) 000-0000" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 transition-colors box-border" />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">Specialty</label>
                <select {...register("specialtyId")} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 box-border">
                  <option value="">Unassigned</option>
                  {(specialties.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">Department</label>
                <select {...register("departmentId")} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 box-border">
                  <option value="">Unassigned</option>
                  {(departments.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">License Number</label>
                <input {...register("licenseNumber")} placeholder="LIC-YYYY-XXXX" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 transition-colors box-border" />
                {errors.licenseNumber && <p className="text-[11px] text-red-600 mt-1">{errors.licenseNumber.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">License Expiry</label>
                <input type="date" {...register("licenseExpiry")} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 transition-colors box-border" />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">Consultation Fee</label>
                <input {...register("consultationFee")} placeholder="150.00" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 transition-colors box-border" />
                {errors.consultationFee && <p className="text-[11px] text-red-600 mt-1">{errors.consultationFee.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">Credentials</label>
                <input {...register("credentials")} placeholder="MD, FACC" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 transition-colors box-border" />
              </div>
            </div>

            <div className="flex gap-2.5 mt-6 justify-end">
              <button type="button" onClick={() => setModalDoctor(null)} className="px-5 py-2.5 bg-muted border border-border rounded-xl cursor-pointer font-semibold text-[13px] text-foreground hover:bg-accent transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2.5 bg-blue-600 text-white border-none rounded-xl cursor-pointer font-bold text-[13px] hover:bg-blue-700 transition-colors disabled:opacity-60">
                {saving ? "Saving…" : modalDoctor === "new" ? "Add Doctor" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
