import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { useBranding } from "../context/BrandingContext";
import ThemeToggle from "../components/ThemeToggle";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Vertical flowing lines animation - Like fiber optic curtain
const WavyBackground = ({ mousePosition }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    // Create vertical flowing lines
    const lines = [];
    const lineCount = 150; // Dense lines like in image
    
    for (let i = 0; i < lineCount; i++) {
      const startX = (canvas.width / lineCount) * i;
      lines.push({
        points: [],
        baseX: startX,
        amplitude: 30 + Math.random() * 50, // Horizontal wave amplitude
        frequency: 0.003 + Math.random() * 0.002,
        speed: 0.2 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
        opacity: 0.1 + Math.random() * 0.3,
        mouseInfluence: 0
      });
      
      // Initialize points for each line from top to bottom
      for (let y = 0; y <= canvas.height; y += 5) {
        lines[i].points.push({ y, x: 0 });
      }
    }

    let animationFrameId;
    let time = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.01;

      lines.forEach((line) => {
        // Calculate mouse influence for this line
        const distanceX = Math.abs(line.baseX - mousePosition.x);
        const targetInfluence = Math.max(0, (400 - distanceX) / 400);
        line.mouseInfluence += (targetInfluence - line.mouseInfluence) * 0.1;

        ctx.beginPath();
        ctx.strokeStyle = `rgba(79, 127, 255, ${line.opacity})`;
        ctx.lineWidth = 1.2;

        // Draw vertical line with horizontal waves
        line.points.forEach((point, index) => {
          // Wave calculation for horizontal displacement
          const wave1 = Math.sin(point.y * line.frequency + time * line.speed + line.phase) * line.amplitude;
          const wave2 = Math.sin(point.y * line.frequency * 0.5 + time * line.speed * 0.7) * (line.amplitude * 0.4);
          
          // Mouse influence - pull lines toward cursor
          const distanceY = Math.abs(point.y - mousePosition.y);
          const totalDistance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
          const mouseEffect = Math.max(0, (300 - totalDistance) / 300) * 100 * line.mouseInfluence;
          
          const x = line.baseX + wave1 + wave2 + mouseEffect;
          
          if (index === 0) {
            ctx.moveTo(x, point.y);
          } else {
            ctx.lineTo(x, point.y);
          }
        });
        
        ctx.stroke();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', setCanvasSize);
    };
  }, [mousePosition]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ email: "", password: "", name: "" });
  const [loading, setLoading] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
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
      toast.success("Login successful!");
      navigate("/");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Invalid credentials");
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
      toast.success("Registration successful!");
      navigate("/");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <WavyBackground mousePosition={mousePosition} />
      
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-between px-8 lg:px-20">
        {/* Left Side */}
        <div className="hidden lg:flex flex-col justify-center w-1/2 pr-12 animate-fadeIn">
          <div className="mb-4">
            <h1 className="text-white text-6xl font-bold mb-2">
              {branding.app_name || "REALFLOW"}
            </h1>
            <p className="text-gray-400 text-sm">EST 2025</p>
          </div>
          
          <h2 className="text-white text-5xl font-bold leading-tight mt-12">
            Start Small. Test One<br/>
            Traffic Source Before<br/>
            Scaling.
          </h2>
          
          <p className="text-gray-500 text-sm mt-8">
            Ready to elevate your affiliate game?<br/>
            Join us in turning community of marketers scaling their projects.
          </p>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full lg:w-1/2 max-w-md mx-auto animate-slideUp">
          <div className="backdrop-blur-md bg-black/40 rounded-3xl p-8 border border-gray-800 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-8">
              <h3 className="text-white text-3xl font-bold mb-2">Hey There,</h3>
              <h4 className="text-[#4F7FFF] text-4xl font-bold mb-4">Welcome Back!</h4>
              <p className="text-gray-400 text-sm">Let's get you back into your account.</p>
            </div>

            {/* Tabs - Simple Login/Register */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveTab("login")}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                  activeTab === "login"
                    ? "bg-[#4F7FFF] text-white shadow-lg shadow-blue-500/50"
                    : "bg-gray-900 text-gray-400 hover:bg-gray-800"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setActiveTab("register")}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                  activeTab === "register"
                    ? "bg-[#4F7FFF] text-white shadow-lg shadow-blue-500/50"
                    : "bg-gray-900 text-gray-400 hover:bg-gray-800"
                }`}
              >
                Register
              </button>
            </div>

            {/* Login Form */}
            {activeTab === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder="shan.ali0744@gmail.com"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    required
                    className="bg-white/90 text-black rounded-full py-6 px-6 focus:ring-2 focus:ring-[#4F7FFF] border-0"
                    data-testid="login-email-input"
                  />
                </div>
                
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                    className="bg-white/90 text-black rounded-full py-6 px-6 pr-12 focus:ring-2 focus:ring-[#4F7FFF] border-0"
                    data-testid="login-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <div className="flex items-center justify-between text-sm mt-4">
                  <Link to="/forgot-password" className="text-gray-400 hover:text-[#4F7FFF] transition">
                    Forgot password?
                  </Link>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3 rounded-full bg-gradient-to-r from-[#4F7FFF] to-[#3D66D9] text-white hover:shadow-lg hover:shadow-blue-500/50 transition-all disabled:opacity-50"
                    data-testid="login-submit-button"
                  >
                    {loading ? "Signing in..." : "Sign In →"}
                  </button>
                </div>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-black text-gray-500">or</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="w-full py-3 px-4 rounded-full bg-gray-900 text-white hover:bg-gray-800 transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <Input
                  type="text"
                  placeholder="Full Name"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  required
                  className="bg-white/90 text-black rounded-full py-6 px-6 focus:ring-2 focus:ring-[#4F7FFF] border-0"
                  data-testid="register-name-input"
                />
                <Input
                  type="email"
                  placeholder="Email Address"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  required
                  className="bg-white/90 text-black rounded-full py-6 px-6 focus:ring-2 focus:ring-[#4F7FFF] border-0"
                  data-testid="register-email-input"
                />
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    required
                    className="bg-white/90 text-black rounded-full py-6 px-6 pr-12 focus:ring-2 focus:ring-[#4F7FFF] border-0"
                    data-testid="register-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-full bg-gradient-to-r from-[#4F7FFF] to-[#3D66D9] text-white hover:shadow-lg hover:shadow-blue-500/50 transition-all disabled:opacity-50"
                  data-testid="register-submit-button"
                >
                  {loading ? "Creating..." : "Create Account"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
