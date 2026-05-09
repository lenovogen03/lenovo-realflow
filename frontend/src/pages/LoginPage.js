import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import { Eye, EyeOff, Shield, Mail } from "lucide-react";
import { useBranding } from "../context/BrandingContext";
import ThemeToggle from "../components/ThemeToggle";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LoginPage() {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [showPassword, setShowPassword] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ email: "", password: "", name: "" });
  const [loading, setLoading] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const backgroundRef = useRef(null);

  // Cursor following effect
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (backgroundRef.current) {
        const rect = backgroundRef.current.getBoundingClientRect();
        setMousePosition({
          x: ((e.clientX - rect.left) / rect.width) * 100,
          y: ((e.clientY - rect.top) / rect.height) * 100,
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/login`, loginForm);
      localStorage.setItem("token", response.data.access_token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      
      // Check if user is pending/blocked
      const userStatus = response.data.user.status;
      if (userStatus === "pending") {
        toast.info("Your account is pending activation. Contact admin for access.");
      } else if (userStatus === "blocked") {
        toast.error("Your account has been blocked. Contact admin for support.");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        return;
      }
      
      toast.success("Login successful!");
      navigate("/");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/register`, registerForm);
      localStorage.setItem("token", response.data.access_token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      toast.success("Registration successful! Contact admin for feature access.");
      navigate("/");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={backgroundRef}
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-all duration-300"
      style={
        branding.login_bg_url
          ? {
              backgroundImage: `url('${branding.login_bg_url}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : {
              background: `
                radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(16, 185, 129, 0.15), transparent 40%),
                radial-gradient(circle at 20% 10%, rgba(16, 185, 129, 0.12), transparent 50%),
                radial-gradient(circle at 85% 90%, rgba(139, 92, 246, 0.10), transparent 50%),
                linear-gradient(135deg, #0a0a0b 0%, #18181b 100%)
              `,
            }
      }
    >
      {/* Animated floating orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-float-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float-slower"></div>
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-float"></div>
      </div>

      {/* Soft overlay only if a custom image background is set */}
      {branding.login_bg_url && (
        <div className="absolute inset-0 bg-black/60"></div>
      )}
      
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      
      <div className="relative z-10 w-full max-w-md animate-slideUp">
        <div className="text-center mb-8 animate-fadeIn">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.app_name} className="h-16 mx-auto mb-4 object-contain animate-scaleIn" />
          ) : (
            <h1 className="text-4xl font-bold mb-2 animate-scaleIn" style={{ color: 'var(--brand-text)' }} data-testid="app-title">{branding.app_name || "RealFlow"}</h1>
          )}
          <p style={{ color: 'var(--brand-muted)' }}>{branding.tagline || "Real Users. Real Results."}</p>
        </div>

        <Card className="backdrop-blur-xl shadow-2xl border-2 hover:border-emerald-500/50 transition-all duration-500 animate-slideUp" 
              style={{ 
                backgroundColor: 'color-mix(in srgb, var(--brand-card) 85%, transparent)', 
                borderColor: 'var(--brand-border)',
                animation: 'slideUp 0.6s ease-out, glow 3s ease-in-out infinite'
              }}>
          <CardHeader className="animate-fadeIn">
            <CardTitle style={{ color: 'var(--brand-text)' }}>Welcome</CardTitle>
            <CardDescription>Sign in to your account or create a new one</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-zinc-900/50">
                <TabsTrigger value="login" data-testid="login-tab" className="transition-all duration-300 data-[state=active]:bg-emerald-600 data-[state=active]:scale-105">Login</TabsTrigger>
                <TabsTrigger value="register" data-testid="register-tab" className="transition-all duration-300 data-[state=active]:bg-emerald-600 data-[state=active]:scale-105">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2 animate-fadeIn" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      data-testid="login-email-input"
                      type="email"
                      placeholder="you@example.com"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      required
                      className="transition-all duration-300 focus:scale-105 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50"
                      style={{ backgroundColor: 'var(--brand-card)', borderColor: 'var(--brand-border)' }}
                    />
                  </div>
                  <div className="space-y-2 animate-fadeIn" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        data-testid="login-password-input"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        required
                        className="pr-10 transition-all duration-300 focus:scale-105 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50"
                        style={{ backgroundColor: 'var(--brand-card)', borderColor: 'var(--brand-border)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-80 hover:scale-110 transition-all duration-200"
                        style={{ color: 'var(--brand-muted)' }}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    data-testid="login-submit-button"
                    className="w-full bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg hover:shadow-emerald-500/50 animate-fadeIn"
                    disabled={loading}
                    style={{ animationDelay: '0.3s', animationFillMode: 'both' }}
                  >
                    {loading ? "Logging in..." : "Login"}
                  </Button>
                  <div className="text-center mt-3">
                    <Link 
                      to="/forgot-password" 
                      className="text-sm hover:underline"
                      style={{ color: 'var(--brand-primary)' }}
                    >
                      Forgot Password?
                    </Link>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2 animate-fadeIn" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
                    <Label htmlFor="register-name">Name</Label>
                    <Input
                      id="register-name"
                      data-testid="register-name-input"
                      type="text"
                      placeholder="John Doe"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      required
                      className="transition-all duration-300 focus:scale-105 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50"
                      style={{ backgroundColor: 'var(--brand-card)', borderColor: 'var(--brand-border)' }}
                    />
                  </div>
                  <div className="space-y-2 animate-fadeIn" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      data-testid="register-email-input"
                      type="email"
                      placeholder="you@example.com"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      required
                      className="transition-all duration-300 focus:scale-105 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50"
                      style={{ backgroundColor: 'var(--brand-card)', borderColor: 'var(--brand-border)' }}
                    />
                  </div>
                  <div className="space-y-2 animate-fadeIn" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
                    <Label htmlFor="register-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="register-password"
                        data-testid="register-password-input"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                        required
                        className="pr-10 transition-all duration-300 focus:scale-105 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50"
                        style={{ backgroundColor: 'var(--brand-card)', borderColor: 'var(--brand-border)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-80 hover:scale-110 transition-all duration-200"
                        style={{ color: 'var(--brand-muted)' }}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    data-testid="register-submit-button"
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg hover:shadow-purple-500/50 animate-fadeIn"
                    disabled={loading}
                    style={{ animationDelay: '0.4s', animationFillMode: 'both' }}
                  >
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
                
                {/* Contact Info for Payment */}
                <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--brand-card)', borderColor: 'var(--brand-border)', border: '1px solid var(--brand-border)' }}>
                  <p className="text-xs mb-2" style={{ color: 'var(--brand-muted)' }}>
                    After registration, contact admin for feature access:
                  </p>
                  <a 
                    href={`mailto:${branding.admin_email || "admin@example.com"}`}
                    className="flex items-center gap-2 text-sm hover:opacity-80 transition-colors"
                    style={{ color: 'var(--brand-primary)' }}
                  >
                    <Mail size={14} />
                    {branding.admin_email || "admin@example.com"}
                  </a>
                </div>
              </TabsContent>
            </Tabs>
            
            {/* Admin Login Link */}
            <div className="mt-6 pt-4 text-center" style={{ borderTop: '1px solid var(--brand-border)' }}>
              <a 
                href="/admin" 
                className="inline-flex items-center gap-2 text-sm transition-colors hover:opacity-80"
                style={{ color: 'var(--brand-muted)' }}
              >
                <Shield size={14} />
                Admin Login
              </a>
            </div>
          </CardContent>
        </Card>
        
        {/* Footer */}
        <p className="text-center text-xs text-[#52525B] mt-6">{branding.footer_text || "© 2026 RealFlow. All rights reserved."}</p>
      </div>
    </div>
  );
}
