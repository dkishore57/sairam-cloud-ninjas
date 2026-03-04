import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { User, GraduationCap, Target, Zap, Flame, Clock, Star } from "lucide-react";

const Profile = () => {
  const { profile } = useAuth();

  const xpForNextLevel = (profile?.level || 1) * 500;
  const xpProgress = ((profile?.xp || 0) / xpForNextLevel) * 100;

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold mb-8">Profile</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* User Info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> Personal Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{profile?.full_name || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{profile?.email || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">College</p>
                <p className="font-medium">{profile?.college_name || "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Year {profile?.year_of_study || "—"}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Level & XP */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-xp" /> Level & XP
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full gradient-primary mb-3">
                  <span className="text-3xl font-bold text-primary-foreground">{profile?.level || 1}</span>
                </div>
                <p className="text-muted-foreground text-sm">Current Level</p>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-xp font-mono">{profile?.xp || 0} XP</span>
                  <span className="text-muted-foreground">{xpForNextLevel} XP</span>
                </div>
                <Progress value={xpProgress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">{Math.round(xpForNextLevel - (profile?.xp || 0))} XP to next level</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Skills */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-level-cyan" /> Skills
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {profile?.skills?.map((s) => (
                  <Badge key={s} className="gradient-primary text-primary-foreground">{s}</Badge>
                )) || <p className="text-sm text-muted-foreground">No skills set</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Level:</span>
                <Badge variant="outline" className="capitalize">{profile?.skill_level || "—"}</Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Goals */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-accent" /> Goals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Target Role</p>
                <p className="font-medium">{profile?.target_role || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dream Company</p>
                <Badge variant="outline" className="capitalize">{profile?.dream_company_type || "—"}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{profile?.daily_study_hours || 0} hrs/day • {profile?.placement_timeline || "—"}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
