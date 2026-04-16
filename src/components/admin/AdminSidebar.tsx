import {
  LayoutDashboard,
  Users,
  FileText,
  DollarSign,
  LogOut,
  ArrowLeft,
} from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const menuItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Usuários", url: "/admin/usuarios", icon: Users },
  { title: "Logs", url: "/admin/logs", icon: FileText },
  { title: "Financeiro", url: "/admin/financeiro", icon: DollarSign },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();

  const isActive = (url: string) => {
    if (url === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(url);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive text-destructive-foreground font-bold text-sm">
            AD
          </div>
          {!collapsed && (
            <span className="font-bold text-lg text-sidebar-foreground">
              Admin
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Painel</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && user && (
          <div className="mb-2">
            <span className="mb-1 inline-block rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              Admin
            </span>
            <p className="truncate text-xs text-sidebar-foreground/70">
              {user.email}
            </p>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
            asChild
          >
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              {!collapsed && <span className="ml-2">Dashboard</span>}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
