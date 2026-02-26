import { Link, useLocation } from "react-router"
import { cn } from "@/lib/utils"

const navItems = [
  { path: "/", label: "Dashboard", icon: "🎯" },
  { path: "/frequency", label: "Frequency", icon: "📊" },
  { path: "/trends", label: "Trends", icon: "📈" },
  { path: "/history", label: "History", icon: "📋" },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="w-64 border-r border-border p-4 hidden md:block">
        <h1 className="text-xl font-bold mb-8 px-2">Toto Huat</h1>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                pathname === item.path
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background z-50">
        <nav className="flex justify-around p-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 rounded-md text-xs",
                pathname === item.path ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="flex-1 p-6 md:p-8 overflow-auto pb-20 md:pb-8">
        {children}
      </main>
    </div>
  )
}
