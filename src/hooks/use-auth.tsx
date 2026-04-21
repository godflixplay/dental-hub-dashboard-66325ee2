import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type UserRole = "cliente" | "admin";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);

  // `loading` só é resetado para true na primeira chamada (boot inicial).
  // Eventos posteriores (TOKEN_REFRESHED, SIGNED_IN repetido) NÃO devem
  // re-disparar a UI global de loading — caso contrário, qualquer refresh
  // de token mostra spinner por toda a tela.
  const initializedRef = useRef(false);
  // `fetchRole` só roda quando o userId muda. Refresh de token mantém o
  // mesmo userId e não deve refazer a query de profile.
  const lastFetchedRoleForRef = useRef<string | null>(null);

  const fetchRole = useCallback(async (userId: string) => {
    if (lastFetchedRoleForRef.current === userId) return;
    lastFetchedRoleForRef.current = userId;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      setRole((data?.role as UserRole) ?? "cliente");
    } catch {
      setRole("cliente");
    }
  }, []);

  const applySession = useCallback(
    (nextSession: Session | null, isInitial: boolean) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        void fetchRole(nextSession.user.id);
      } else {
        // Só limpa role se realmente não há sessão (logout). Durante
        // refresh de token, nextSession nunca fica null.
        lastFetchedRoleForRef.current = null;
        setRole(null);
      }

      // Apenas o boot inicial controla o `loading` global.
      if (isInitial) {
        setLoading(false);
      }
    },
    [fetchRole],
  );

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Eventos subsequentes nunca voltam loading=true.
      applySession(nextSession, false);
    });

    void supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      initializedRef.current = true;
      applySession(nextSession, true);
    });

    return () => subscription.unsubscribe();
  }, [applySession]);

  const signOut = async () => {
    lastFetchedRoleForRef.current = null;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
