import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { Flame, Zap, Target, BookOpen, TrendingUp, Map, Trophy } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

const mockWeeklyData = [
  { day: "Mon", xp: 45 }, { day: "Tue", xp: 80 }, { day: "Wed", xp: 60 },
  { day: "Thu", xp: 120 }, { day: "Fri", xp: 90 }, { day: "Sat", xp: 150 },
  { day: "Sun", xp: 70 },
];

const Dashboard = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [streak, setStreak] = useState({ current_streak: 0, longest_streak: 0 });
  const [roadmap, setRoadmap] = useState<any>(null);
  const [questionsCompleted, setQuestionsCompleted] = useState(0);

  useEffect(() => {
    if (profile && !profile.onboarding_completed) {
      navigate("/onboarding");
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (!user) return;
    // Fetch streak
    supabase.from("streaks").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setStreak(data); });
    // Fetch roadmap
    supabase.from("roadmaps").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (data) setRoadmap(data); });
    // Fetch question progress
    supabase.from("user_question_progress").select("id", { count: "exact" }).eq("user_id", user.id).eq("completed", true)
      .then(({ count }) => setQuestionsCompleted(count || 0));
  }, [user]);

  const statCards = [
    { icon: Flame, label: "Current Streak", value: `${streak.current_streak} days`, color: "text-streak", bg: "bg-streak/10" },
    { icon: Zap, label: "XP Points", value: `${profile?.xp || 0}`, color: "text-xp", bg: "bg-xp/10" },
    { icon: Target, label: "Level", value: `${profile?.level || 1}`, color: "text-level-cyan", bg: "bg-level-cyan/10" },
    { icon: BookOpen, label: "Questions Solved", value: `${questionsCompleted}`, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold"
        >
          Welcome back, {profile?.full_name || "Learner"} 👋
        </motion.h1>
        <p className="text-muted-foreground mt-1">
          {profile?.target_role ? `Preparing for ${profile.target_role}` : "Let's crush it today!"}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="shadow-card border-border/50">
              <CardContent className="p-5">
                <div className={`inline-flex p-2 rounded-lg ${stat.bg} mb-3`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* XP Chart */}
        <Card className="lg:col-span-2 shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Weekly Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mockWeeklyData}>
                <defs>
                  <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 16%, 18%)" />
                <XAxis dataKey="day" stroke="hsl(215, 20%, 55%)" fontSize={12} />
                <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "hsl(230, 20%, 10%)", border: "1px solid hsl(230, 16%, 18%)", borderRadius: "8px" }}
                  labelStyle={{ color: "hsl(210, 40%, 96%)" }}
                />
                <Area type="monotone" dataKey="xp" stroke="hsl(160, 84%, 39%)" fill="url(#xpGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="space-y-4">
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Map className="h-5 w-5 text-accent" />
                Roadmap Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              {roadmap ? (
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Week {roadmap.current_week}/{roadmap.total_weeks}</span>
                    <span className="font-mono text-primary">{roadmap.progress_pct}%</span>
                  </div>
                  <Progress value={roadmap.progress_pct} className="h-2" />
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">No roadmap yet</p>
                  <Button onClick={() => navigate("/roadmap")} size="sm" className="gradient-primary text-primary-foreground">
                    Generate Roadmap
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-5 w-5 text-xp" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 flex-wrap">
                {streak.current_streak >= 3 && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-10 h-10 rounded-full bg-streak/20 flex items-center justify-center">
                      <Flame className="h-5 w-5 text-streak" />
                    </div>
                    <span className="text-xs text-muted-foreground">3-Day</span>
                  </div>
                )}
                {questionsCompleted >= 5 && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground">5 Qs</span>
                  </div>
                )}
                {questionsCompleted === 0 && streak.current_streak < 3 && (
                  <p className="text-sm text-muted-foreground">Complete tasks to earn badges!</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
