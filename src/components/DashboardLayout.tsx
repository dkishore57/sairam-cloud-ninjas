import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Brain, LayoutDashboard, Map, BookOpen, User, LogOut, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/roadmap", icon: Map, label: "Roadmap" },
  { to: "/practice", icon: BookOpen, label: "Practice" },
  { to: "/profile", icon: User, label: "Profile" },
];

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card p-4">
        <Link to="/dashboard" className="flex items-center gap-2 px-3 py-4 mb-6">
          <Brain className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold">PrepGenius</span>
        </Link>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                location.pathname === item.to
                  ? "gradient-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Stats mini */}
        {profile && (
          <div className="glass rounded-xl p-4 mb-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Flame className="h-4 w-4 text-streak" />
              <span className="text-muted-foreground">Level {profile.level}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xp font-mono font-semibold">{profile.xp} XP</span>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          className="justify-start text-muted-foreground"
          onClick={async () => { await signOut(); navigate("/login"); }}
        >
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg">
        <nav className="flex justify-around py-2">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 text-xs",
                location.pathname === item.to ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto p-6">{children}</div>
      </main>
    </div>
  );
};
