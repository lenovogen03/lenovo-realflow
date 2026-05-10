import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { Eye, EyeOff, Shield, ArrowLeft } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Wavy background for admin page
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

    const lines = [];
    const lineCount = 150;
    
    for (let i = 0; i < lineCount; i++) {
      const startX = (canvas.width / lineCount) * i;
      lines.push({
        points: [],
        baseX: startX,
        amplitude: 30 + Math.random() * 50,
        frequency: 0.003 + Math.random() * 0.002,
        speed: 0.2 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
        opacity: 0.15 + Math.random() * 0.25,
        mouseInfluence: 0,
        targetInfluence: 0
      });
      
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
        const distanceX = Math.abs(line.baseX - mousePosition.x);
        const spotlightRadius = 500;
        const isInSpotlight = distanceX < spotlightRadius;
        
        const targetInfluence = isInSpotlight 
          ? Math.max(0, (spotlightRadius - distanceX) / spotlightRadius)
          : 0;
        
        line.targetInfluence = targetInfluence;
        line.mouseInfluence += (line.targetInfluence - line.mouseInfluence) * 0.08;

        if (line.mouseInfluence > 0.01) {
          ctx.beginPath();
          const finalOpacity = line.opacity * (0.3 + line.mouseInfluence * 0.7);
          ctx.strokeStyle = `rgba(79, 127, 255, ${finalOpacity})`;
          ctx.lineWidth = 1.2;

          line.points.forEach((point, index) => {
            const activeAmplitude = line.amplitude * line.mouseInfluence;
            const wave1 = Math.sin(point.y * line.frequency + time * line.speed + line.phase) * activeAmplitude;
            const wave2 = Math.sin(point.y * line.frequency * 0.5 + time * line.speed * 0.7) * (activeAmplitude * 0.4);
            
            const distanceY = Math.abs(point.y - mousePosition.y);
            const totalDistance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
            const mouseEffect = Math.max(0, (300 - totalDistance) / 300) * 80 * line.mouseInfluence;
            
            const x = line.baseX + wave1 + wave2 + mouseEffect;
            
            if (index === 0) {
              ctx.moveTo(x, point.y);
            } else {
              ctx.lineTo(x, point.y);
            }
          });
          
          ctx.stroke();
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', setCanvasSize);
    };
  }, [mousePosition]);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }} />;
};

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const navigate = useNavigate();

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
      const response = await axios.post(`${API}/admin/login`, { email, password });
      localStorage.setItem("adminToken", response.data.access_token);
      localStorage.setItem("isAdmin", "true");
      toast.success("Admin login successful!");
      navigate("/admin/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Invalid admin credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <WavyBackground mousePosition={mousePosition} />
      
      <Link to="/login" className="absolute top-6 left-6 z-20 flex items-center gap-2 text-gray-400 hover:text-[#4F7FFF] transition">
        <ArrowLeft size={20} />
        <span>Back to User Login</span>
      </Link>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-8">
        <div className="w-full max-w-md animate-slideUp">
          <div className="backdrop-blur-md bg-black/40 rounded-3xl p-8 border border-gray-800 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-block p-4 bg-gradient-to-br from-[#4F7FFF] to-[#3D66D9] rounded-2xl mb-4">
                <Shield size={40} className="text-white" />
              </div>
              <h3 className="text-white text-3xl font-bold mb-2">Admin Access</h3>
              <h4 className="text-[#4F7FFF] text-2xl font-bold mb-4">System Control Panel</h4>
              <p className="text-gray-400 text-sm">Enter your admin credentials to continue</p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4" data-testid="admin-login-form">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="admin@realflow.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white/90 text-black rounded-full py-6 px-6 focus:ring-2 focus:ring-[#4F7FFF] border-0"
                  data-testid="admin-email-input"
                />
              </div>
              
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-white/90 text-black rounded-full py-6 px-6 pr-12 focus:ring-2 focus:ring-[#4F7FFF] border-0"
                  data-testid="admin-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-full bg-gradient-to-r from-[#4F7FFF] to-[#3D66D9] text-white font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="admin-login-submit"
              >
                <Shield size={20} />
                {loading ? "Authenticating..." : "Access Admin Panel →"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                🔒 Secure admin authentication
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
