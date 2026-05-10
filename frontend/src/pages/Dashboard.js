import { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { MousePointerClick, TrendingUp, DollarSign, Users } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLORS = ['#4F7FFF', '#3D66D9', '#6B95FF', '#22C55E', '#F59E0B'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white">Loading dashboard...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">No data available</div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Clicks",
      value: stats.total_clicks.toLocaleString(),
      icon: MousePointerClick,
      color: "#3B82F6",
      testid: "stat-total-clicks"
    },
    {
      title: "Unique Clicks",
      value: stats.unique_clicks.toLocaleString(),
      icon: Users,
      color: "#22C55E",
      testid: "stat-unique-clicks"
    },
    {
      title: "Conversions",
      value: stats.total_conversions.toLocaleString(),
      icon: TrendingUp,
      color: "#F59E0B",
      testid: "stat-conversions"
    },
    {
      title: "Revenue",
      value: `$${stats.revenue.toLocaleString()}`,
      icon: DollarSign,
      color: "#22C55E",
      testid: "stat-revenue"
    },
  ];

  const deviceData = stats.clicks_by_device.map(item => ({
    name: item.device.charAt(0).toUpperCase() + item.device.slice(1),
    value: item.count
  }));

  return (
    <div className="space-y-6 page-enter" data-testid="dashboard">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} 
                  className="stat-card-hover card-themed animate-fadeIn" 
                  style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}
                  data-testid={stat.testid}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-themed">
                  {stat.title}
                </CardTitle>
                <div
                  className="w-10 h-10 rounded-md flex items-center justify-center transition-transform duration-300 hover:scale-110"
                  style={{ backgroundColor: `${stat.color}20` }}
                >
                  <Icon size={20} style={{ color: stat.color }} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono">{stat.value}</div>
                {stat.title === "Conversions" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.conversion_rate}% conversion rate
                  </p>
                )}
                {stat.title === "Revenue" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ${stats.epc} EPC
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-hover card-themed animate-fadeIn" style={{ animationDelay: '0.5s', animationFillMode: 'both' }} data-testid="clicks-chart">
          <CardHeader>
            <CardTitle className="text-lg text-themed">Clicks Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.clicks_by_date}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" />
                <XAxis dataKey="date" stroke="var(--brand-muted)" style={{ fontSize: 12 }} />
                <YAxis stroke="var(--brand-muted)" style={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--brand-card)',
                    border: '1px solid var(--brand-border)',
                    borderRadius: '6px',
                    color: 'var(--brand-text)'
                  }}
                />
                <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-hover card-themed animate-fadeIn" style={{ animationDelay: '0.6s', animationFillMode: 'both' }} data-testid="revenue-chart">
          <CardHeader>
            <CardTitle className="text-lg text-themed">Revenue Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.revenue_by_date}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" />
                <XAxis dataKey="date" stroke="var(--brand-muted)" style={{ fontSize: 12 }} />
                <YAxis stroke="var(--brand-muted)" style={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--brand-card)',
                    border: '1px solid var(--brand-border)',
                    borderRadius: '6px',
                    color: 'var(--brand-text)'
                  }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#22C55E" strokeWidth={2} dot={{ fill: '#22C55E' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-hover card-themed animate-fadeIn" style={{ animationDelay: '0.7s', animationFillMode: 'both' }} data-testid="country-chart">
          <CardHeader>
            <CardTitle className="text-lg text-themed">Top Countries</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.clicks_by_country}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" />
                <XAxis dataKey="country" stroke="var(--brand-muted)" style={{ fontSize: 12 }} />
                <YAxis stroke="var(--brand-muted)" style={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--brand-card)',
                    border: '1px solid var(--brand-border)',
                    borderRadius: '6px',
                    color: 'var(--brand-text)'
                  }}
                />
                <Bar dataKey="count" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-hover card-themed animate-fadeIn" style={{ animationDelay: '0.8s', animationFillMode: 'both' }} data-testid="device-chart">
          <CardHeader>
            <CardTitle className="text-lg text-themed">Device Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={deviceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {deviceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--brand-card)',
                    border: '1px solid var(--brand-border)',
                    borderRadius: '6px',
                    color: 'var(--brand-text)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
