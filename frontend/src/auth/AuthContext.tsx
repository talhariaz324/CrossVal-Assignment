import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setAuthToken } from "../api/client";

interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = "orders_and_settlements_auth";

interface StoredAuth {
  token: string;
  user: AuthUser;
}

function loadStored(): StoredAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const stored = loadStored();
    if (stored) {
      setAuthToken(stored.token);
      setUser(stored.user);
    }
    setInitialized(true);
  }, []);

  function persist(auth: StoredAuth) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    setAuthToken(auth.token);
    setUser(auth.user);
  }

  async function login(email: string, password: string) {
    const result = await api.post<StoredAuth>("/auth/login", { email, password });
    persist(result);
  }

  async function signup(email: string, password: string) {
    const result = await api.post<StoredAuth>("/auth/signup", { email, password });
    persist(result);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setUser(null);
  }

  if (!initialized) return null;

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
