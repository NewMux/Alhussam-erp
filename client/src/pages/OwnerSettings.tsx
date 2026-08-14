import { useState } from "react";
import { CheckCircle2, Edit3, Link as LinkIcon, Loader2, Plus, ShieldCheck, Sparkles, UserCheck, UserCog, UserX } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const permissions = [
  { value: "dashboard", label: "Business dashboard", detail: "Review sales, stock, and operational metrics." },
  { value: "customers", label: "Customers & measurements", detail: "Maintain client records and fitting versions." },
  { value: "sales", label: "Sales & invoices", detail: "Use POS, record manual sales, and print invoices." },
  { value: "inventory", label: "Inventory control", detail: "Maintain materials and stock adjustments." },
  { value: "production", label: "Tailoring production", detail: "Manage orders from confirmation through handover." },
  { value: "payroll", label: "Workforce & payroll", detail: "Manage attendance, production records, and payouts." },
] as const;
type Permission = (typeof permissions)[number]["value"];

const roleTemplates: Array<{ name: string; description: string; permissions: Permission[] }> = [
  { name: "Shop manager", description: "Runs daily operations across the ERP.", permissions: ["dashboard", "customers", "sales", "inventory", "production", "payroll"] },
  { name: "Cashier", description: "Serves clients at the counter and issues invoices.", permissions: ["dashboard", "customers", "sales"] },
  { name: "Master tailor", description: "Uses measurements and advances tailoring orders.", permissions: ["customers", "production"] },
  { name: "Stock controller", description: "Maintains materials, balances, and stock adjustments.", permissions: ["inventory"] },
  { name: "Payroll officer", description: "Maintains attendance, performance, and payouts.", permissions: ["payroll"] },
];

type RoleValue = { name: string; description: string; permissions: Permission[]; isActive: boolean };

function RoleForm({ role, onSave, pending, submitLabel = "Create role" }: { role?: { name: string; description: string | null; permissions: string[]; isActive: boolean }; onSave: (value: RoleValue) => void; pending: boolean; submitLabel?: string }) {
  return <form className="space-y-4" onSubmit={event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selected = permissions.filter(item => form.get(item.value) === "on").map(item => item.value);
    if (!selected.length) return toast.error("Choose at least one responsibility.");
    onSave({ name: String(form.get("name")), description: String(form.get("description") || ""), permissions: selected, isActive: form.get("isActive") === "on" });
  }}>
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="space-y-1.5"><Label htmlFor="role-name">Role name</Label><Input id="role-name" name="name" defaultValue={role?.name || ""} required placeholder="e.g. Counter supervisor" /></div>
      <label className="flex h-10 items-center gap-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={role?.isActive ?? true} />Available</label>
    </div>
    <div className="space-y-1.5"><Label htmlFor="role-description">Short description</Label><Textarea id="role-description" name="description" defaultValue={role?.description || ""} placeholder="Describe this person’s responsibility." /></div>
    <div className="space-y-2"><Label>Allowed work areas</Label><div className="grid gap-2 sm:grid-cols-2">{permissions.map(item => <label key={item.value} className="flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"><input name={item.value} type="checkbox" defaultChecked={role?.permissions.includes(item.value)} className="mt-1" /><span><span className="block text-sm font-medium">{item.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.detail}</span></span></label>)}</div></div>
    <Button className="w-full" disabled={pending}>{submitLabel}</Button>
  </form>;
}

export default function OwnerSettings() {
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [exactApprovalId, setExactApprovalId] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState("");

  const shop = trpc.erp.shop.get.useQuery();
  const users = trpc.erp.team.listRoles.useQuery();
  const roles = trpc.erp.team.listCustomRoles.useQuery();
  const pending = trpc.erp.access.listPending.useQuery();
  const utils = trpc.useUtils();
  const refresh = () => { utils.erp.team.listRoles.invalidate(); utils.erp.team.listCustomRoles.invalidate(); utils.erp.access.listPending.invalidate(); };
  const saveShop = trpc.erp.shop.save.useMutation({ onSuccess: () => { utils.erp.shop.get.invalidate(); setProfileOpen(false); toast.success("Shop profile saved"); }, onError: error => toast.error(error.message) });
  const createRole = trpc.erp.team.createCustomRole.useMutation({ onSuccess: () => { refresh(); setCreateOpen(false); setTemplateName(""); toast.success("Role created"); }, onError: error => toast.error(error.message) });
  const updateRole = trpc.erp.team.updateCustomRole.useMutation({ onSuccess: () => { refresh(); setEditingRoleId(null); toast.success("Role updated"); }, onError: error => toast.error(error.message) });
  const assignRole = trpc.erp.team.assignCustomRole.useMutation({ onSuccess: () => { refresh(); toast.success("Staff access updated"); }, onError: error => toast.error(error.message) });
  const clearRole = trpc.erp.team.clearCustomRole.useMutation({ onSuccess: () => { refresh(); toast.success("Custom assignment removed"); }, onError: error => toast.error(error.message) });
  const approve = trpc.erp.access.approvePending.useMutation({ onSuccess: () => { refresh(); toast.success("Access approved and role assigned"); }, onError: error => toast.error(error.message) });
  const reject = trpc.erp.access.rejectPending.useMutation({ onSuccess: () => { refresh(); toast.success("Access request rejected"); }, onError: error => toast.error(error.message) });
  const approveExact = trpc.erp.accessApproval.approveWithPermissions.useMutation({ onSuccess: () => { refresh(); setExactApprovalId(null); toast.success("Access approved with a new exact-permission role"); }, onError: error => toast.error(error.message) });

  if (shop.isLoading || users.isLoading || roles.isLoading || pending.isLoading) return <div className="flex min-h-[280px] items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading owner settings…</div>;
  if (shop.error || users.error || roles.error || pending.error) return <p className="text-destructive">{shop.error?.message || users.error?.message || roles.error?.message || pending.error?.message}</p>;

  const activeRoles = roles.data?.filter(role => role.isActive) || [];
  const editingRole = roles.data?.find(role => role.id === editingRoleId);
  const exactApproval = pending.data?.find(request => request.id === exactApprovalId);
  const pendingCount = pending.data?.length || 0;
  const approvedCount = users.data?.length || 0;
  const roleCount = activeRoles.length;
  const copyLoginLink = () => navigator.clipboard?.writeText(window.location.origin).then(() => toast.success("Production login link copied"), () => toast.error("Unable to copy the link"));
  const createTemplate = () => {
    const template = roleTemplates.find(item => item.name === templateName);
    if (!template) return;
    if (roles.data?.some(role => role.name.toLowerCase() === template.name.toLowerCase())) return toast.error("A role with this name already exists.");
    createRole.mutate(template);
  };

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Owner control centre</p><h1 className="mt-2 text-3xl font-semibold">Staff access & roles</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Approve new staff, assign a role, and adjust access when responsibilities change.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={copyLoginLink}><LinkIcon className="mr-2 h-4 w-4" />Copy login link</Button>
        <Dialog open={profileOpen} onOpenChange={setProfileOpen}><DialogTrigger asChild><Button variant="outline">Business profile</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Business profile</DialogTitle><DialogDescription>Information printed on invoices and shown throughout the ERP.</DialogDescription></DialogHeader><form className="space-y-3" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); saveShop.mutate({ shopName: String(f.get("shopName")), arabicShopName: String(f.get("arabicShopName") || ""), crNumber: String(f.get("crNumber") || ""), currency: "BHD", phone: String(f.get("phone") || ""), email: String(f.get("email") || ""), address: String(f.get("address") || ""), invoicePrefix: String(f.get("invoicePrefix")) }); }}><div className="space-y-1.5"><Label>Shop name</Label><Input name="shopName" defaultValue={shop.data?.shopName || ""} required /></div><div className="space-y-1.5"><Label>Arabic shop name</Label><Input name="arabicShopName" defaultValue={shop.data?.arabicShopName || ""} /></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Commercial registration</Label><Input name="crNumber" defaultValue={shop.data?.crNumber || ""} /></div><div className="space-y-1.5"><Label>Invoice prefix</Label><Input name="invoicePrefix" defaultValue={shop.data?.invoicePrefix || "INV"} required /></div></div><div className="space-y-1.5"><Label>Phone</Label><Input name="phone" defaultValue={shop.data?.phone || ""} /></div><div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" defaultValue={shop.data?.email || ""} /></div><div className="space-y-1.5"><Label>Business address</Label><Textarea name="address" defaultValue={shop.data?.address || ""} /></div><Button className="w-full" disabled={saveShop.isPending}>Save business profile</Button></form></DialogContent></Dialog>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New role</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Create owner-managed role</DialogTitle><DialogDescription>Define reusable responsibilities without IT support.</DialogDescription></DialogHeader><RoleForm pending={createRole.isPending} onSave={value => createRole.mutate(value)} /></DialogContent></Dialog>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border bg-card p-4"><p className="text-2xl font-semibold">{pendingCount}</p><p className="mt-1 text-sm font-medium">Pending decisions</p><p className="mt-1 text-xs text-muted-foreground">New sign-ins wait here for approval.</p></div>
      <div className="rounded-xl border bg-card p-4"><p className="text-2xl font-semibold">{approvedCount}</p><p className="mt-1 text-sm font-medium">Approved staff</p><p className="mt-1 text-xs text-muted-foreground">People with owner-managed access.</p></div>
      <div className="rounded-xl border bg-card p-4"><p className="text-2xl font-semibold">{roleCount}</p><p className="mt-1 text-sm font-medium">Available roles</p><p className="mt-1 text-xs text-muted-foreground">Share link → approve → assign a role.</p></div>
    </div>

    <Card>
      <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-base"><UserCheck className="h-4 w-4 text-primary" />Access requests <Badge variant="secondary">{pendingCount}</Badge></CardTitle><CardDescription>New users remain blocked until you approve or reject their request.</CardDescription></CardHeader>
      <CardContent>{pending.data?.length ? <div className="space-y-3">{pending.data.map(request => <form key={request.id} className="flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center lg:justify-between" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const customRoleId = Number(form.get("customRoleId")); if (!customRoleId) return toast.error("Choose a role before approving."); approve.mutate({ requestId: request.id, customRoleId, note: String(form.get("note") || "") }); }}><div><p className="font-semibold">{request.name}</p><p className="text-sm text-muted-foreground">{request.email || `User #${request.userId}`}</p><p className="mt-1 text-xs text-muted-foreground">Requested {new Date(request.requestedAt).toLocaleString()}</p></div><div className="flex flex-wrap items-center justify-end gap-2"><select name="customRoleId" className="h-10 min-w-[180px] rounded-md border bg-white px-3 text-sm"><option value="">Choose a role…</option>{activeRoles.map(role => <option value={role.id} key={role.id}>{role.name}</option>)}</select><Input name="note" className="h-10 w-44" maxLength={500} placeholder="Optional note" /><Button size="sm" disabled={approve.isPending || !activeRoles.length}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Approve</Button><Button type="button" size="sm" variant="outline" onClick={() => setExactApprovalId(request.id)}><Sparkles className="mr-1.5 h-3.5 w-3.5" />Custom</Button><Button type="button" size="sm" variant="outline" onClick={() => reject.mutate({ requestId: request.id, note: "" })} disabled={reject.isPending}><UserX className="mr-1.5 h-3.5 w-3.5" />Reject</Button></div></form>)}</div> : <div className="flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />No requests waiting. Share the login link when you are ready to invite staff.</div>}</CardContent>
    </Card>

    <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <Card>
        <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-base"><UserCog className="h-4 w-4 text-primary" />Approved staff</CardTitle><CardDescription>Change a person’s role or pause their access when needed.</CardDescription></CardHeader>
        <CardContent className="space-y-3">{users.data?.length ? users.data.map(user => <form key={user.userId} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); const roleId = Number(f.get("customRoleId")); if (!roleId) return clearRole.mutate({ userId: user.userId }); assignRole.mutate({ userId: user.userId, customRoleId: roleId, isActive: f.get("isActive") === "on" }); }}><div className="min-w-0"><p className="truncate font-semibold">{user.name || `User #${user.userId}`}</p><p className="truncate text-xs text-muted-foreground">{user.email || `Signed-in user #${user.userId}`}</p><p className="mt-1 text-xs text-muted-foreground">{user.customRoleName || user.businessRole}</p></div><div className="flex flex-wrap items-center gap-2"><select name="customRoleId" defaultValue={user.customRoleId ? String(user.customRoleId) : ""} className="h-10 min-w-[180px] rounded-md border bg-white px-3 text-sm"><option value="">Use basic sales access</option>{activeRoles.map(role => <option value={role.id} key={role.id}>{role.name}</option>)}</select><label className="flex items-center gap-1.5 text-xs"><input name="isActive" type="checkbox" defaultChecked={user.customRoleActive} />Active</label><Button size="sm" variant="outline" disabled={assignRole.isPending || clearRole.isPending}>Save</Button></div></form>) : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Approved staff will appear here after their first sign-in.</p>}</CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />Role library</CardTitle><CardDescription>Create a role once, then reuse it for staff approvals.</CardDescription></CardHeader>
        <CardContent className="space-y-4"><div className="flex gap-2"><select value={templateName} onChange={event => setTemplateName(event.target.value)} className="h-10 min-w-0 flex-1 rounded-md border bg-white px-3 text-sm"><option value="">Add a suggested role…</option>{roleTemplates.map(template => <option key={template.name} value={template.name} disabled={Boolean(roles.data?.some(role => role.name.toLowerCase() === template.name.toLowerCase()))}>{template.name}</option>)}</select><Button type="button" variant="outline" disabled={!templateName || createRole.isPending} onClick={createTemplate}>Add</Button></div><div className="space-y-2">{roles.data?.length ? roles.data.map(role => <div key={role.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{role.name}</p><p className="mt-1 text-xs text-muted-foreground">{role.permissions.length} permitted work area{role.permissions.length === 1 ? "" : "s"}</p></div><div className="flex shrink-0 items-center gap-2"><Badge variant={role.isActive ? "secondary" : "outline"}>{role.isActive ? "Live" : "Paused"}</Badge><Button size="sm" variant="ghost" onClick={() => setEditingRoleId(role.id)}><Edit3 className="mr-1.5 h-3.5 w-3.5" />Edit</Button></div></div></div>) : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No reusable roles yet. Add a suggested role or create one from scratch.</p>}</div></CardContent>
      </Card>
    </div>

    <Dialog open={!!exactApproval} onOpenChange={open => !open && setExactApprovalId(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Approve with custom access</DialogTitle><DialogDescription>Create a one-off role for {exactApproval?.name || "this person"} by selecting the allowed work areas.</DialogDescription></DialogHeader>{exactApproval && <RoleForm pending={approveExact.isPending} submitLabel="Create role & approve access" onSave={value => approveExact.mutate({ requestId: exactApproval.id, name: value.name, description: value.description, permissions: value.permissions, note: "" })} />}</DialogContent></Dialog>
    <Dialog open={!!editingRole} onOpenChange={open => !open && setEditingRoleId(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Edit role</DialogTitle><DialogDescription>Changes apply to active assignees immediately.</DialogDescription></DialogHeader>{editingRole && <RoleForm role={editingRole} pending={updateRole.isPending} submitLabel="Save role" onSave={value => updateRole.mutate({ id: editingRole.id, ...value })} />}</DialogContent></Dialog>
  </div>;
}
