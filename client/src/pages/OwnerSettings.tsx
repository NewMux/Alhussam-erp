import { useState } from "react";
import { CheckCircle2, Edit3, Link as LinkIcon, Loader2, Plus, Settings2, ShieldCheck, Sparkles, UserCheck, UserCog, UserX } from "lucide-react";
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
  { value: "payroll", label: "Workforce & payroll", detail: "Manage attendance, performance, and payouts." },
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
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><div className="space-y-1.5"><Label htmlFor="role-name">Role name</Label><Input id="role-name" name="name" defaultValue={role?.name || ""} required placeholder="e.g. Counter supervisor" /></div><label className="flex h-10 items-center gap-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={role?.isActive ?? true} />Available</label></div>
    <div className="space-y-1.5"><Label htmlFor="role-description">Short description</Label><Textarea id="role-description" name="description" defaultValue={role?.description || ""} placeholder="Describe this person’s responsibility." /></div>
    <div className="space-y-2"><Label>Allowed work areas</Label><div className="grid gap-2 sm:grid-cols-2">{permissions.map(item => <label key={item.value} className="flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"><input name={item.value} type="checkbox" defaultChecked={role?.permissions.includes(item.value)} className="mt-1" /><span><span className="block text-sm font-medium">{item.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.detail}</span></span></label>)}</div></div>
    <Button className="w-full" disabled={pending}>{submitLabel}</Button>
  </form>;
}

export default function OwnerSettings() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [exactApprovalId, setExactApprovalId] = useState<number | null>(null);
  const [reviewingRequestId, setReviewingRequestId] = useState<number | null>(null);
  const [managingUserId, setManagingUserId] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState("");

  const shop = trpc.erp.shop.get.useQuery();
  const users = trpc.erp.team.listRoles.useQuery();
  const roles = trpc.erp.team.listCustomRoles.useQuery();
  const pending = trpc.erp.access.listPending.useQuery();
  const utils = trpc.useUtils();
  const refresh = () => { utils.erp.team.listRoles.invalidate(); utils.erp.team.listCustomRoles.invalidate(); utils.erp.access.listPending.invalidate(); };
  const saveShop = trpc.erp.shop.save.useMutation({ onSuccess: () => { utils.erp.shop.get.invalidate(); setProfileOpen(false); toast.success("Shop profile saved"); }, onError: error => toast.error(error.message) });
  const createRole = trpc.erp.team.createCustomRole.useMutation({ onSuccess: () => { refresh(); setCreateOpen(false); setTemplateName(""); }, onError: error => toast.error(error.message) });
  const updateRole = trpc.erp.team.updateCustomRole.useMutation({ onSuccess: () => { refresh(); setEditingRoleId(null); toast.success("Role updated"); }, onError: error => toast.error(error.message) });
  const assignRole = trpc.erp.team.assignCustomRole.useMutation({ onSuccess: () => { refresh(); setManagingUserId(null); toast.success("Staff access updated"); }, onError: error => toast.error(error.message) });
  const clearRole = trpc.erp.team.clearCustomRole.useMutation({ onSuccess: () => { refresh(); setManagingUserId(null); toast.success("Custom assignment removed"); }, onError: error => toast.error(error.message) });
  const approve = trpc.erp.access.approvePending.useMutation({ onSuccess: () => { refresh(); toast.success("Access approved"); }, onError: error => toast.error(error.message) });
  const reject = trpc.erp.access.rejectPending.useMutation({ onSuccess: () => { refresh(); setReviewingRequestId(null); toast.success("Access request rejected"); }, onError: error => toast.error(error.message) });
  const approveExact = trpc.erp.accessApproval.approveWithPermissions.useMutation({ onSuccess: () => { refresh(); setExactApprovalId(null); toast.success("Custom access approved"); }, onError: error => toast.error(error.message) });

  if (shop.isLoading || users.isLoading || roles.isLoading || pending.isLoading) return <div className="flex min-h-[280px] items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading owner settings…</div>;
  if (shop.error || users.error || roles.error || pending.error) return <p className="text-destructive">{shop.error?.message || users.error?.message || roles.error?.message || pending.error?.message}</p>;

  const activeRoles = roles.data?.filter(role => role.isActive) || [];
  const pendingCount = pending.data?.length || 0;
  const editingRole = roles.data?.find(role => role.id === editingRoleId);
  const exactApproval = pending.data?.find(request => request.id === exactApprovalId);
  const reviewingRequest = pending.data?.find(request => request.id === reviewingRequestId);
  const managingUser = users.data?.find(user => user.userId === managingUserId);
  const copyLoginLink = () => navigator.clipboard?.writeText(window.location.origin).then(() => toast.success("Secure sign-in link copied"), () => toast.error("Unable to copy the link"));
  const findOrCreateTemplate = (name: string, completed: (roleId: number) => void) => {
    const template = roleTemplates.find(item => item.name === name);
    if (!template) return;
    const existing = activeRoles.find(role => role.name.toLowerCase() === template.name.toLowerCase());
    if (existing) return completed(existing.id);
    createRole.mutate(template, { onSuccess: result => completed(result.id) });
  };
  const approveWithChoice = (requestId: number, choice: string) => {
    if (choice.startsWith("template:")) return findOrCreateTemplate(choice.slice(9), roleId => approve.mutate({ requestId, customRoleId: roleId, note: "" }));
    const roleId = Number(choice.replace("role:", ""));
    if (!roleId) return toast.error("Choose a role before approving.");
    approve.mutate({ requestId, customRoleId: roleId, note: "" });
  };
  const saveStaffAccess = (userId: number, choice: string, isActive: boolean) => {
    if (choice === "base") return clearRole.mutate({ userId });
    if (choice.startsWith("template:")) return findOrCreateTemplate(choice.slice(9), roleId => assignRole.mutate({ userId, customRoleId: roleId, isActive }));
    const roleId = Number(choice.replace("role:", ""));
    if (!roleId) return toast.error("Choose a role.");
    assignRole.mutate({ userId, customRoleId: roleId, isActive });
  };
  const addTemplate = () => {
    if (!templateName) return;
    const template = roleTemplates.find(item => item.name === templateName);
    if (!template) return;
    if (roles.data?.some(role => role.name.toLowerCase() === template.name.toLowerCase())) return toast.error("This role is already in your library.");
    createRole.mutate(template, { onSuccess: () => toast.success(`${template.name} added to the role library`) });
  };

  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Owner control centre</p><h1 className="mt-2 text-3xl font-semibold">Staff access</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">For most staff, there is one decision: choose a standard role, then approve. Custom access is available only when you need it.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={copyLoginLink}><LinkIcon className="mr-2 h-4 w-4" />Copy sign-in link</Button><Dialog open={rolesOpen} onOpenChange={setRolesOpen}><DialogTrigger asChild><Button variant="outline"><Settings2 className="mr-2 h-4 w-4" />Manage roles</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Role library</DialogTitle><DialogDescription>Standard roles work immediately. Create or edit a custom role only when the standard roles do not fit.</DialogDescription></DialogHeader><div className="space-y-4"><div className="rounded-lg border bg-muted/30 p-3"><Label className="text-xs">Add a standard role to your library</Label><div className="mt-2 flex gap-2"><select value={templateName} onChange={event => setTemplateName(event.target.value)} className="h-10 min-w-0 flex-1 rounded-md border bg-white px-3 text-sm"><option value="">Choose a standard role…</option>{roleTemplates.map(template => <option key={template.name} value={template.name} disabled={Boolean(roles.data?.some(role => role.name.toLowerCase() === template.name.toLowerCase()))}>{template.name}</option>)}</select><Button type="button" variant="outline" onClick={addTemplate} disabled={!templateName || createRole.isPending}>Add</Button></div></div><Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogTrigger asChild><Button className="w-full" variant="outline"><Plus className="mr-2 h-4 w-4" />Create custom role</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Create custom role</DialogTitle><DialogDescription>Use this for an exception to the standard roles.</DialogDescription></DialogHeader><RoleForm pending={createRole.isPending} onSave={value => createRole.mutate(value, { onSuccess: () => toast.success("Custom role created") })} /></DialogContent></Dialog><div className="space-y-2">{roles.data?.length ? roles.data.map(role => <div key={role.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{role.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{role.permissions.length} work area{role.permissions.length === 1 ? "" : "s"} · {role.isActive ? "Available" : "Paused"}</p></div><Button size="sm" variant="ghost" onClick={() => setEditingRoleId(role.id)}><Edit3 className="mr-1.5 h-3.5 w-3.5" />Edit</Button></div>) : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">You do not need to prepare roles in advance. Standard roles are created automatically when you first use one.</p>}</div></div></DialogContent></Dialog><Dialog open={profileOpen} onOpenChange={setProfileOpen}><DialogTrigger asChild><Button variant="ghost">Shop details</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Business profile</DialogTitle><DialogDescription>Information printed on invoices and shown throughout the ERP.</DialogDescription></DialogHeader><form className="space-y-3" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); saveShop.mutate({ shopName: String(f.get("shopName")), arabicShopName: String(f.get("arabicShopName") || ""), crNumber: String(f.get("crNumber") || ""), currency: "BHD", phone: String(f.get("phone") || ""), email: String(f.get("email") || ""), address: String(f.get("address") || ""), invoicePrefix: String(f.get("invoicePrefix")) }); }}><div className="space-y-1.5"><Label>Shop name</Label><Input name="shopName" defaultValue={shop.data?.shopName || ""} required /></div><div className="space-y-1.5"><Label>Arabic shop name</Label><Input name="arabicShopName" defaultValue={shop.data?.arabicShopName || ""} /></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Commercial registration</Label><Input name="crNumber" defaultValue={shop.data?.crNumber || ""} /></div><div className="space-y-1.5"><Label>Invoice prefix</Label><Input name="invoicePrefix" defaultValue={shop.data?.invoicePrefix || "INV"} required /></div></div><div className="space-y-1.5"><Label>Phone</Label><Input name="phone" defaultValue={shop.data?.phone || ""} /></div><div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" defaultValue={shop.data?.email || ""} /></div><div className="space-y-1.5"><Label>Business address</Label><Textarea name="address" defaultValue={shop.data?.address || ""} /></div><Button className="w-full" disabled={saveShop.isPending}>Save business profile</Button></form></DialogContent></Dialog></div></div>

    <Card className="border-primary/20"><CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-base"><UserCheck className="h-4 w-4 text-primary" />New staff requests {pendingCount ? <Badge variant="secondary">{pendingCount}</Badge> : null}</CardTitle><CardDescription>Share the sign-in link. When someone signs in, select the role that best matches their work and approve them.</CardDescription></CardHeader><CardContent>{pending.data?.length ? <div className="space-y-3">{pending.data.map(request => <form key={request.id} className="flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center lg:justify-between" onSubmit={event => { event.preventDefault(); const choice = String(new FormData(event.currentTarget).get("roleChoice") || ""); approveWithChoice(request.id, choice); }}><div><p className="font-semibold">{request.name}</p><p className="text-sm text-muted-foreground">{request.email || `User #${request.userId}`}</p></div><div className="flex flex-wrap items-center gap-2"><select name="roleChoice" defaultValue="template:Cashier" className="h-10 min-w-[210px] rounded-md border bg-white px-3 text-sm"><optgroup label="Standard roles">{roleTemplates.map(template => <option key={template.name} value={`template:${template.name}`}>{template.name}</option>)}</optgroup>{activeRoles.length ? <optgroup label="Saved roles">{activeRoles.map(role => <option value={`role:${role.id}`} key={role.id}>{role.name}</option>)}</optgroup> : null}</select><Button size="sm" disabled={approve.isPending || createRole.isPending}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Approve</Button><Button type="button" size="sm" variant="ghost" onClick={() => setReviewingRequestId(request.id)}>More</Button></div></form>)}</div> : <div className="flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />No requests waiting. Staff appear here after they sign in with the link.</div>}</CardContent></Card>

    <Card><CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-base"><UserCog className="h-4 w-4 text-primary" />Current access</CardTitle><CardDescription>Review existing staff only when their responsibility changes.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{users.data?.map(user => <div key={user.userId} className="flex items-center justify-between gap-3 rounded-xl border p-4"><div className="min-w-0"><p className="truncate font-semibold">{user.name || `User #${user.userId}`}</p><p className="truncate text-xs text-muted-foreground">{user.email || `Signed-in user #${user.userId}`}</p><p className="mt-1 text-xs text-muted-foreground">{user.customRoleName || user.businessRole}</p></div><Button size="sm" variant="outline" onClick={() => setManagingUserId(user.userId)}>Manage</Button></div>)}</CardContent></Card>

    <Dialog open={!!reviewingRequest} onOpenChange={open => !open && setReviewingRequestId(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>More options</DialogTitle><DialogDescription>Use these only when a standard role is not appropriate for {reviewingRequest?.name || "this person"}.</DialogDescription></DialogHeader><div className="grid gap-2"><Button variant="outline" onClick={() => { setExactApprovalId(reviewingRequestId); setReviewingRequestId(null); }}><Sparkles className="mr-2 h-4 w-4" />Set custom access</Button><Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => reviewingRequestId && reject.mutate({ requestId: reviewingRequestId, note: "" })} disabled={reject.isPending}><UserX className="mr-2 h-4 w-4" />Reject request</Button></div></DialogContent></Dialog>
    <Dialog open={!!managingUser} onOpenChange={open => !open && setManagingUserId(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Manage access</DialogTitle><DialogDescription>{managingUser?.name || "Staff member"} keeps their current access until you save a change.</DialogDescription></DialogHeader>{managingUser && <form className="space-y-4" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); saveStaffAccess(managingUser.userId, String(form.get("roleChoice") || "base"), form.get("isActive") === "on"); }}><div className="space-y-1.5"><Label>Role</Label><select name="roleChoice" defaultValue={managingUser.customRoleId ? `role:${managingUser.customRoleId}` : "base"} className="h-10 w-full rounded-md border bg-white px-3 text-sm"><option value="base">Keep existing base access</option><optgroup label="Standard roles">{roleTemplates.map(template => <option key={template.name} value={`template:${template.name}`}>{template.name}</option>)}</optgroup>{activeRoles.length ? <optgroup label="Saved roles">{activeRoles.map(role => <option value={`role:${role.id}`} key={role.id}>{role.name}</option>)}</optgroup> : null}</select></div><label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={managingUser.customRoleActive} />Role is active</label><Button className="w-full" disabled={assignRole.isPending || clearRole.isPending || createRole.isPending}>Save access</Button></form>}</DialogContent></Dialog>
    <Dialog open={!!exactApproval} onOpenChange={open => !open && setExactApprovalId(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Set custom access</DialogTitle><DialogDescription>Create a one-off role for {exactApproval?.name || "this person"} by selecting the allowed work areas.</DialogDescription></DialogHeader>{exactApproval && <RoleForm pending={approveExact.isPending} submitLabel="Approve with custom access" onSave={value => approveExact.mutate({ requestId: exactApproval.id, name: value.name, description: value.description, permissions: value.permissions, note: "" })} />}</DialogContent></Dialog>
    <Dialog open={!!editingRole} onOpenChange={open => !open && setEditingRoleId(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Edit role</DialogTitle><DialogDescription>Changes apply to active assignees immediately.</DialogDescription></DialogHeader>{editingRole && <RoleForm role={editingRole} pending={updateRole.isPending} submitLabel="Save role" onSave={value => updateRole.mutate({ id: editingRole.id, ...value })} />}</DialogContent></Dialog>
  </div>;
}
