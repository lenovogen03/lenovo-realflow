import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Link2, MousePointerClick, DollarSign, Server, Menu, LogOut, User, Settings, TrendingUp, Upload, Mail, Filter, Smartphone, Search, ClipboardCheck, Fingerprint, Package, Apple, Cpu, Briefcase, ChevronDown, ChevronRight, Link as LinkIcon, Activity, Camera } from "lucide-react";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { useBranding } from "../context/BrandingContext";
import ThemeToggle from "./ThemeToggle";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DashboardLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // CPI group expanded by default if user is currently on a CPI page
  const initialCpiOpen = (() => {
    try { return location.pathname.startsWith("/cpi"); } catch { return false; }
  })();
  const [cpiGroupOpen, setCpiGroupOpen] = useState(initialCpiOpen);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "{}"));
  const [loading, setLoading] = useState(true);

  // Fetch fresh user data on mount to get updated features
  useEffect(() => {
    const fetchUserData = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const response = await axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const freshUserData = response.data;
        
        // Update localStorage with fresh data
        const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
        const updatedUser = { ...currentUser, ...freshUserData };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setUser(updatedUser);
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        // If token is invalid, redirect to login
        if (error.response?.status === 401 || error.response?.status === 403) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  const isSubUser = user.is_sub_user === true;
  const features = user.features || {};

  // Build navigation based on user's enabled features
  const allNavItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard, feature: null }, // Always show dashboard
    { name: "Links", path: "/links", icon: Link2, feature: "links" },
    { name: "Clicks", path: "/clicks", icon: MousePointerClick, feature: "clicks" },
    { name: "Traffic Sources", path: "/referrers", icon: TrendingUp, feature: "clicks" },
    { name: "Import Traffic", path: "/import-traffic", icon: Upload, feature: "import_traffic" },
    { name: "Email Checker", path: "/email-checker", icon: Mail, feature: "email_checker" },
    { name: "Separate Data", path: "/separate-data", icon: Filter, feature: "separate_data" },
    { name: "UA Generator", path: "/ua-generator", icon: Smartphone, feature: "ua_generator" },
    { name: "UA Checker", path: "/ua-checker", icon: Search, feature: "ua_generator" },
    { name: "Form Filler", path: "/form-filler", icon: ClipboardCheck, feature: "form_filler" },
    { name: "Real User Traffic", path: "/real-user-traffic", icon: Fingerprint, feature: "real_user_traffic" },
    { name: "Visual Recorder", path: "/visual-recorder", icon: Camera, feature: "real_user_traffic" },
    { name: "Uploaded Things", path: "/uploaded-things", icon: Package, feature: "real_user_traffic" },
    {
      name: "CPI Module",
      icon: Briefcase,
      feature: "cpi",
      group: true,
      children: [
        { name: "Dashboard", path: "/cpi", icon: LayoutDashboard },
        { name: "Offers", path: "/cpi/offers", icon: Apple },
        { name: "Jobs", path: "/cpi/jobs", icon: Cpu },
        { name: "Devices", path: "/cpi/devices", icon: Smartphone },
        { name: "Smart Links", path: "/cpi/smartlinks", icon: LinkIcon },
        { name: "Worker Setup", path: "/cpi/setup", icon: Settings },
      ],
    },
    { name: "Conversions", path: "/conversions", icon: DollarSign, feature: "conversions" },
    { name: "Proxies", path: "/proxies", icon: Server, feature: "proxies" },
  ];

  // Backward compat: new granular features fall back to "import_data" legacy flag
  const LEGACY_IMPORT_GROUP = new Set([
    "email_checker", "separate_data", "import_traffic", "real_traffic", "ua_generator"
  ]);

  // Filter navigation: show only enabled features (groups + flat items)
  const navigation = allNavItems.filter(item => {
    if (item.feature === null || item.feature === undefined) return true; // Always show
    if (features[item.feature] === true) return true;
    // Legacy fallback
    if (
      features[item.feature] === undefined &&
      LEGACY_IMPORT_GROUP.has(item.feature) &&
      features.import_data === true
    ) {
      return true;
    }
    return false;
  });

  // Add Settings - ONLY for main users, and only if settings feature is not explicitly false
  // Sub-users NEVER see Settings
  if (!isSubUser && features.settings !== false) {
    navigation.push({ name: "Settings", path: "/settings", icon: Settings, feature: "settings" });
  }

  // System Health is ALWAYS visible to every logged-in user (main + sub).
  // No feature flag — every owner should be able to check the stack
  // before launching a job, and one-click auto-repair if needed.
  navigation.push({ name: "System Health", path: "/system-health", icon: Activity, feature: null });

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--brand-background)' }}>
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } sidebar-brand transition-all duration-300 flex flex-col`}
        style={{ 
          backgroundColor: 'var(--brand-background)', 
          borderRight: '1px solid var(--brand-border)' 
        }}
        data-testid="sidebar"
      >
        <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid var(--brand-border)' }}>
          {sidebarOpen && (
            branding.logo_url ? (
              <img src={branding.logo_url} alt={branding.app_name} className="h-8 object-contain" data-testid="app-logo" />
            ) : (
              <h1 className="text-xl font-bold" style={{ color: 'var(--brand-text)' }} data-testid="app-logo">{branding.app_name || "RealFlow"}</h1>
            )
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hover:opacity-80"
            style={{ backgroundColor: 'transparent' }}
            data-testid="sidebar-toggle"
          >
            <Menu size={20} />
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            // Group with collapsible children (e.g., CPI Module)
            if (item.group) {
              const anyChildActive = item.children.some(c => location.pathname === c.path);
              const expanded = cpiGroupOpen || anyChildActive;
              return (
                <div key={item.name}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors"
                    style={{
                      backgroundColor: anyChildActive ? 'var(--brand-card)' : 'transparent',
                      color: 'var(--brand-muted)',
                    }}
                    onClick={() => setCpiGroupOpen(!cpiGroupOpen)}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--brand-card)')}
                    onMouseLeave={(e) => !anyChildActive && (e.currentTarget.style.backgroundColor = 'transparent')}
                    data-testid={`nav-group-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon size={20} />
                    {sidebarOpen && (
                      <>
                        <span className="text-sm font-medium flex-1 text-left">{item.name}</span>
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </>
                    )}
                  </button>
                  {sidebarOpen && expanded && (
                    <div className="ml-3 mt-1 space-y-1 border-l pl-3" style={{ borderColor: 'var(--brand-border)' }}>
                      {item.children.map((c) => {
                        const isActive = location.pathname === c.path;
                        const CIcon = c.icon;
                        return (
                          <Link key={c.path} to={c.path}>
                            <div
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-xs"
                              style={{
                                backgroundColor: isActive ? 'var(--brand-primary)' : 'transparent',
                                color: isActive ? 'white' : 'var(--brand-muted)',
                              }}
                              onMouseEnter={(e) => !isActive && (e.currentTarget.style.backgroundColor = 'var(--brand-card)')}
                              onMouseLeave={(e) => !isActive && (e.currentTarget.style.backgroundColor = 'transparent')}
                              data-testid={`nav-${c.name.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              <CIcon size={14} />
                              <span className="font-medium">{c.name}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            // Regular flat item
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <div
                  className={`sidebar-item flex items-center gap-3 px-3 py-2 rounded-md ${isActive ? 'active' : ''}`}
                  style={{
                    backgroundColor: isActive ? 'var(--brand-primary)' : 'transparent',
                    color: isActive ? 'white' : 'var(--brand-muted)',
                  }}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon size={20} className="icon-hover" />
                  {sidebarOpen && <span className="text-sm font-medium">{item.name}</span>}
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header 
          className="h-16 flex items-center justify-between px-6 header-animated shadow-sm"
          style={{ 
            backgroundColor: 'var(--brand-background)', 
            borderBottom: '1px solid var(--brand-border)' 
          }}
        >
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold animate-fadeIn" style={{ color: 'var(--brand-text)' }} data-testid="page-title">
              {(() => {
                for (const it of navigation) {
                  if (it.path === location.pathname) return it.name;
                  if (it.group && it.children) {
                    const c = it.children.find(c => c.path === location.pathname);
                    if (c) return `${it.name} → ${c.name}`;
                  }
                }
                return "Dashboard";
              })()}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 btn-animated" data-testid="user-menu">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 hover:rotate-12"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  <User size={18} />
                </div>
                <span className="text-sm">{user.name || "User"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {!isSubUser && (
                <DropdownMenuItem onClick={() => navigate("/settings")} data-testid="settings-button">
                  <Settings size={16} className="mr-2" />
                  Settings
                </DropdownMenuItem>
              )}
              {!isSubUser && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={handleLogout} data-testid="logout-button">
                <LogOut size={16} className="mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 content-wrapper" data-testid="main-content" style={{ backgroundColor: 'var(--brand-background)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
