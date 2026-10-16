import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Users, CheckCircle, XCircle, Clock, MessageCircle, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface UserWithRole {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  approval_status: string;
  roles: string[];
}

const ROLE_HIERARCHY: Record<string, number> = { customer: 0, staff: 1, admin: 2, super_admin: 3 };
const WHATSAPP_HELP = "https://wa.me/8801873722228?text=Hi%2C%20I%20need%20help%20with%20Medsuite-eT%20platform";

const UserManagement = () => {
  const { t } = useLanguage();
  const { isAdmin, isSuperAdmin, user: currentUser, roles: currentRoles } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  const currentMaxRole = Math.max(...currentRoles.map(r => ROLE_HIERARCHY[r] || 0));

  const fetchUsers = async () => {
    setLoading(true);
    const profiles = await api.profiles.list();
    const roles = await api.userRoles.list();

    const roleMap: Record<string, string[]> = {};
    roles.forEach((r) => {
      if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
      roleMap[r.user_id].push(r.role);
    });

    let userList = profiles.map((p: any) => ({
      user_id: p.user_id,
      full_name: p.full_name,
      phone: p.phone,
      created_at: p.created_at,
      approval_status: p.approval_status || "approved",
      roles: roleMap[p.user_id] || ["customer"],
    }));

    if (!isSuperAdmin) {
      userList = userList.filter(u => !u.roles.includes("super_admin"));
    }

    setUsers(userList);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const getMaxRole = (roles: string[]) => Math.max(...roles.map(r => ROLE_HIERARCHY[r] || 0));

  const canChangeRole = (targetUser: UserWithRole): boolean => {
    if (targetUser.user_id === currentUser?.id) return false;
    const targetMax = getMaxRole(targetUser.roles);
    return currentMaxRole > targetMax;
  };

  const getAllowedRoles = (): string[] => {
    if (isSuperAdmin) return ["customer", "staff", "admin"];
    if (isAdmin) return ["customer", "staff"];
    return [];
  };

  const changeRole = async (userId: string, newRole: string) => {
    const targetUser = users.find(u => u.user_id === userId);
    if (!targetUser || !canChangeRole(targetUser)) {
      toast.error(t("um_role_current"));
      return;
    }
    if (ROLE_HIERARCHY[newRole] >= currentMaxRole) {
      toast.error(t("um_role_higher"));
      return;
    }
    try {
      await api.userRoles.set(userId, newRole);
      toast.success(t("um_role_updated") + ": " + newRole);
      fetchUsers();
    } catch (e: any) {
      toast.error(t("settings_save_failed") + ": " + (e.message || ""));
    }
  };

  const updateApproval = async (userId: string, status: string) => {
    try {
      await api.profiles.update({ user_id: userId, approval_status: status });
      toast.success(`${t("um_user_status")} ${status}`);
      fetchUsers();
    } catch (e: any) {
      toast.error(t("settings_save_failed") + ": " + (e.message || ""));
    }
  };

  const removeUser = async (userId: string) => {
    if (!isSuperAdmin) { toast.error(t("um_only_super_remove")); return; }
    if (userId === currentUser?.id) { toast.error(t("um_cannot_remove_self")); return; }
    const targetUser = users.find(u => u.user_id === userId);
    if (targetUser && getMaxRole(targetUser.roles) >= currentMaxRole) {
      toast.error(t("um_cannot_remove_higher")); return;
    }
    try {
      await api.userRoles.removeUser(userId);
      toast.success(t("um_user_removed"));
      fetchUsers();
    } catch (e: any) {
      toast.error(t("settings_save_failed") + ": " + (e.message || ""));
    }
  };

  if (!isAdmin) {
    return <div className="py-20 text-center text-muted-foreground">{t("um_access_denied")}</div>;
  }

  const pendingUsers = users.filter((u) => u.approval_status === "pending");
  const approvedUsers = users.filter((u) => u.approval_status !== "pending");
  const allowedRoles = getAllowedRoles();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> {t("nav_user_mgmt")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{t("um_subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto" asChild>
          <a href={WHATSAPP_HELP} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" /> {t("um_whatsapp_help")}
          </a>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-2 sm:gap-4 grid-cols-2 sm:grid-cols-4">
        <Card><CardContent className="pt-3 sm:pt-4 px-3"><p className="text-[10px] sm:text-sm text-muted-foreground">{t("um_total")}</p><p className="text-xl sm:text-2xl font-bold">{users.length}</p></CardContent></Card>
        <Card><CardContent className="pt-3 sm:pt-4 px-3"><p className="text-[10px] sm:text-sm text-muted-foreground">{t("um_pending")}</p><p className="text-xl sm:text-2xl font-bold text-amber-600">{pendingUsers.length}</p></CardContent></Card>
        <Card><CardContent className="pt-3 sm:pt-4 px-3"><p className="text-[10px] sm:text-sm text-muted-foreground">{t("um_staff")}</p><p className="text-xl sm:text-2xl font-bold text-primary">{users.filter(u => u.roles.includes("staff") || u.roles.includes("admin")).length}</p></CardContent></Card>
        <Card><CardContent className="pt-3 sm:pt-4 px-3"><p className="text-[10px] sm:text-sm text-muted-foreground">{t("um_customers")}</p><p className="text-xl sm:text-2xl font-bold">{users.filter(u => u.roles.includes("customer") && !u.roles.includes("staff")).length}</p></CardContent></Card>
      </div>

      {/* Pending Approvals */}
      {pendingUsers.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-amber-600 text-sm sm:text-base">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" /> {t("um_pending")} ({pendingUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto px-3 sm:px-6">
            <div className="space-y-2 sm:hidden">
              {pendingUsers.map((u) => (
                <div key={u.user_id} className="p-3 rounded-lg border border-border space-y-2">
                  <div>
                    <p className="font-medium text-sm">{u.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={() => updateApproval(u.user_id, "approved")}>
                      <CheckCircle className="h-3 w-3" /> {t("um_approve")}
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs gap-1" onClick={() => updateApproval(u.user_id, "rejected")}>
                      <XCircle className="h-3 w-3" /> {t("um_reject")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Table className="hidden sm:table">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("um_col_name")}</TableHead>
                  <TableHead>{t("um_col_phone")}</TableHead>
                  <TableHead>{t("um_col_signed_up")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-sm">{u.phone || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => updateApproval(u.user_id, "approved")}>
                          <CheckCircle className="h-3 w-3" /> {t("um_approve")}
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={() => updateApproval(u.user_id, "rejected")}>
                          <XCircle className="h-3 w-3" /> {t("um_reject")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Users */}
      <Card>
        <CardHeader className="pb-2 px-3 sm:px-6"><CardTitle className="text-sm sm:text-base">{t("um_all_users")} ({approvedUsers.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto px-3 sm:px-6">
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">{t("um_loading")}</p>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="space-y-2 sm:hidden">
                {approvedUsers.map((u) => {
                  const editable = canChangeRole(u);
                  return (
                    <div key={u.user_id} className="p-3 rounded-lg border border-border space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{u.full_name || "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{u.phone || "—"}</p>
                        </div>
                        <Badge variant={u.approval_status === "approved" ? "secondary" : "destructive"} className="text-[10px]">
                          {u.approval_status}
                        </Badge>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {u.roles.map(r => (
                          <Badge key={r} variant={r === "super_admin" || r === "admin" ? "default" : r === "staff" ? "secondary" : "outline"} className="gap-1 text-[10px]">
                            {(r === "admin" || r === "super_admin") && <Shield className="h-2.5 w-2.5" />}
                            {r}
                          </Badge>
                        ))}
                      </div>
                      {editable && (
                        <div className="flex gap-2">
                          <Select defaultValue={u.roles[0]} onValueChange={(v) => changeRole(u.user_id, v)}>
                            <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {allowedRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {isSuperAdmin && (
                            <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive" onClick={() => removeUser(u.user_id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop table view */}
              <Table className="hidden sm:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("um_col_name")}</TableHead>
                    <TableHead>{t("um_col_phone")}</TableHead>
                    <TableHead>{t("um_col_status")}</TableHead>
                    <TableHead>{t("um_col_role")}</TableHead>
                    {allowedRoles.length > 0 && <TableHead>{t("um_col_change_role")}</TableHead>}
                    {isSuperAdmin && <TableHead>{t("actions")}</TableHead>}
                    <TableHead>{t("um_col_joined")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedUsers.map((u) => {
                    const editable = canChangeRole(u);
                    return (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                        <TableCell className="text-sm">{u.phone || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={u.approval_status === "approved" ? "secondary" : "destructive"}>{u.approval_status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {u.roles.map(r => (
                              <Badge key={r} variant={r === "super_admin" || r === "admin" ? "default" : r === "staff" ? "secondary" : "outline"} className="gap-1">
                                {(r === "admin" || r === "super_admin") && <Shield className="h-3 w-3" />}
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        {allowedRoles.length > 0 && (
                          <TableCell>
                            {editable ? (
                              <Select defaultValue={u.roles[0]} onValueChange={(v) => changeRole(u.user_id, v)}>
                                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {allowedRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                        )}
                        {isSuperAdmin && (
                          <TableCell>
                            {editable ? (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive gap-1" onClick={() => removeUser(u.user_id)}>
                                <Trash2 className="h-3 w-3" /> {t("um_remove")}
                              </Button>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                        )}
                        <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default UserManagement;
