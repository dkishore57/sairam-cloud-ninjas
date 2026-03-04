import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Sparkles, CheckCircle2, Circle, BookOpen, Play, ExternalLink, Loader2 } from "lucide-react";

interface WeekData {
  week: number;
  title: string;
  topics: string[];
  problems: string[];
  resources: { type: string; title: string; url: string }[];
  completed?: boolean;
}

const Roadmap = () => {
  const { user, profile } = useAuth();
  const [roadmap, setRoadmap] = useState<any>(null);
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [generating, setGenerating] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("roadmaps").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRoadmap(data);
          const rd = data.roadmap_data as any;
          if (rd?.weeks) setWeeks(rd.weeks);
        }
      });
  }, [user]);

  const generateRoadmap = async () => {
    if (!user || !profile) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-roadmap", {
        body: {
          skills: profile.skills,
          skill_level: profile.skill_level,
          dream_company_type: profile.dream_company_type,
          target_role: profile.target_role,
          daily_study_hours: profile.daily_study_hours,
          placement_timeline: profile.placement_timeline,
        },
      });
      if (error) throw error;

      const roadmapData = data?.roadmap;
      if (!roadmapData) throw new Error("No roadmap data returned");

      // Save to DB
      const { data: saved, error: saveErr } = await supabase
        .from("roadmaps")
        .insert({
          user_id: user.id,
          title: `${profile.target_role || "Placement"} Prep Roadmap`,
          roadmap_data: roadmapData,
          total_weeks: roadmapData.weeks?.length || 12,
        })
        .select()
        .single();

      if (saveErr) throw saveErr;
      setRoadmap(saved);
      setWeeks(roadmapData.weeks || []);
      toast.success("Roadmap generated! 🎉");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate roadmap");
    } finally {
      setGenerating(false);
    }
  };

  if (!roadmap) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-12 max-w-md"
          >
            <Sparkles className="h-16 w-16 text-primary mx-auto mb-6 animate-pulse-glow" />
            <h2 className="text-2xl font-bold mb-3">Generate Your AI Roadmap</h2>
            <p className="text-muted-foreground mb-6">
              Based on your profile, we'll create a personalized 12-week prep plan with topics, problems, and resources.
            </p>
            <Button
              onClick={generateRoadmap}
              disabled={generating}
              size="lg"
              className="gradient-primary text-primary-foreground shadow-glow-primary"
            >
              {generating ? (
                <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Generating...</span>
              ) : (
                <span className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Generate Roadmap</span>
              )}
            </Button>
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{roadmap.title}</h1>
          <p className="text-muted-foreground">
            Week {roadmap.current_week} of {roadmap.total_weeks} • {roadmap.progress_pct}% complete
          </p>
        </div>
        <Button onClick={generateRoadmap} disabled={generating} variant="outline" size="sm">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Regenerate"}
        </Button>
      </div>

      <div className="space-y-4">
        {weeks.map((week, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card
              className={`shadow-card border-border/50 cursor-pointer transition-all hover:border-primary/30 ${
                expandedWeek === i ? "border-primary/50" : ""
              }`}
              onClick={() => setExpandedWeek(expandedWeek === i ? null : i)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3 text-base">
                  {week.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <span>Week {week.week}: {week.title}</span>
                  {i === (roadmap.current_week - 1) && (
                    <Badge className="gradient-primary text-primary-foreground text-xs ml-auto">Current</Badge>
                  )}
                </CardTitle>
              </CardHeader>

              {expandedWeek === i && (
                <CardContent className="pt-2 space-y-4">
                  {week.topics?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Topics</p>
                      <div className="flex flex-wrap gap-2">
                        {week.topics.map((t, j) => (
                          <Badge key={j} variant="outline" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {week.problems?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Practice Problems</p>
                      <ul className="space-y-1">
                        {week.problems.map((p, j) => (
                          <li key={j} className="text-sm flex items-center gap-2">
                            <Play className="h-3 w-3 text-primary" /> {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {week.resources?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Resources</p>
                      <ul className="space-y-1">
                        {week.resources.map((r, j) => (
                          <li key={j} className="text-sm flex items-center gap-2">
                            <ExternalLink className="h-3 w-3 text-accent" />
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                              {r.title}
                            </a>
                            <Badge variant="outline" className="text-xs">{r.type}</Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </motion.div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default Roadmap;
