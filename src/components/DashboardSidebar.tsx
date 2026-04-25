import { Cake, Megaphone, Bell, UserCheck, LayoutDashboard, LogOut, Shield, Users, CreditCard, LifeBuoy, Mail, MessageCircle } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const SUPPORT_EMAIL = "contato@dentalhub.com.br";
const SUPPORT_WHATSAPP_DISPLAY = "(21) 98108-9100";
const SUPPORT_WHATSAPP_LINK = "https://wa.me/5521981089100";

const clientMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Meus Contatos", url: "/dashboard/contatos", icon: Users },
  { title: "Aniversários", url: "/dashboard/aniversarios", icon: Cake },
  { title: "Campanhas", url: "/dashboard/campanhas", icon: Megaphone },
  { title: "Lembretes", url: "/dashboard/lembretes", icon: Bell },
  { title: "Recuperação", url: "/dashboard/recuperacao", icon: UserCheck },
  { title: "Assinatura", url: "/dashboard/assinatura", icon: CreditCard },
];

const adminMenuItems = [
  { title: "Painel Admin", url: "/admin", icon: Shield },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user, role } = useAuth();

  const menuItems = role === "admin" ? adminMenuItems : clientMenuItems;

  const isActive = (url: string) => {
    if (url === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(url);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            DH
          </div>
          {!collapsed && (
            <span className="font-bold text-lg text-sidebar-foreground">
              Dental Hub
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{role === "admin" ? "Administração" : "Menu"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                  >
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Suporte */}
              <SidebarMenuItem>
                <Popover>
                  <PopoverTrigger asChild>
                    <SidebarMenuButton tooltip="Suporte">
                      <LifeBuoy className="h-4 w-4" />
                      {!collapsed && <span>Suporte</span>}
                    </SidebarMenuButton>
                  </PopoverTrigger>
                  <PopoverContent
                    side="right"
                    align="start"
                    className="w-72 space-y-3 p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Fale com o suporte
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Estamos aqui para ajudar.
                      </p>
                    </div>
                    <a
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className="flex items-start gap-2 rounded-md p-2 hover:bg-muted"
                    >
                      <Mail className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">E-mail</p>
                        <p className="text-sm font-medium">{SUPPORT_EMAIL}</p>
                      </div>
                    </a>
                    <a
                      href={SUPPORT_WHATSAPP_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 rounded-md p-2 hover:bg-muted"
                    >
                      <MessageCircle className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">WhatsApp</p>
                        <p className="text-sm font-medium">
                          {SUPPORT_WHATSAPP_DISPLAY}
                        </p>
                      </div>
                    </a>
                  </PopoverContent>
                </Popover>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && user && (
          <div className="mb-2">
            {role === "admin" && (
              <span className="mb-1 inline-block rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Admin
              </span>
            )}
            <p className="truncate text-xs text-sidebar-foreground/70">
              {user.email}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
