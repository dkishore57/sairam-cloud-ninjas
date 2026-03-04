import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Rocket, GraduationCap, Target, Clock } from "lucide-react";

const SKILLS = [
  "Python", "Java", "C++", "JavaScript", "TypeScript", "React", "Node.js",
  "SQL", "MongoDB", "Docker", "AWS", "Machine Learning", "Data Structures",
  "Algorithms", "System Design", "Git", "REST APIs", "GraphQL",
];

const ROLES = [
  "Software Development Engineer (SDE)",
  "Data Analyst",
  "ML Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "DevOps Engineer",
  "Product Manager",
];

const Onboarding = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    college_name: "",
    year_of_study: 3,
    skills: [] as string[],
    skill_level: "beginner",
    dream_company_type: "product",
    target_role: "",
    daily_study_hours: 2,
    placement_timeline: "3 months",
  });

  const toggleSkill = (skill: string) => {
    setForm((f) => ({
      ...f,
      skills: f.skills.includes(skill)
        ? f.skills.filter((s) => s !== skill)
        : [...f.skills, skill],
    }));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          college_name: form.college_name,
          year_of_study: form.year_of_study,
          skills: form.skills,
          skill_level: form.skill_level,
          dream_company_type: form.dream_company_type,
          target_role: form.target_role,
          daily_study_hours: form.daily_study_hours,
          placement_timeline: form.placement_timeline,
          onboarding_completed: true,
        })
        .eq("user_id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Profile set up! Let's generate your roadmap 🚀");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      icon: <GraduationCap className="h-8 w-8 text-primary" />,
      title: "Academic Info",
      content: (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>College Name</Label>
            <Input value={form.college_name} onChange={(e) => setForm((f) => ({ ...f, college_name: e.target.value }))} placeholder="e.g. IIT Delhi" className="h-12 bg-secondary" />
          </div>
          <div className="space-y-2">
            <Label>Year of Study</Label>
            <Select value={String(form.year_of_study)} onValueChange={(v) => setForm((f) => ({ ...f, year_of_study: Number(v) }))}>
              <SelectTrigger className="h-12 bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((y) => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      ),
    },
    {
      icon: <Target className="h-8 w-8 text-accent" />,
      title: "Skills & Level",
      content: (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Select your skills</Label>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((s) => (
                <Badge
                  key={s}
                  variant={form.skills.includes(s) ? "default" : "outline"}
                  className={`cursor-pointer transition-all ${form.skills.includes(s) ? "gradient-primary text-primary-foreground" : "hover:border-primary"}`}
                  onClick={() => toggleSkill(s)}
                >
                  {s}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Skill Level</Label>
            <Select value={form.skill_level} onValueChange={(v) => setForm((f) => ({ ...f, skill_level: v }))}>
              <SelectTrigger className="h-12 bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ),
    },
    {
      icon: <Rocket className="h-8 w-8 text-xp" />,
      title: "Goals",
      content: (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Dream Company Type</Label>
            <Select value={form.dream_company_type} onValueChange={(v) => setForm((f) => ({ ...f, dream_company_type: v }))}>
              <SelectTrigger className="h-12 bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="faang">FAANG</SelectItem>
                <SelectItem value="product">Product-based</SelectItem>
                <SelectItem value="service">Service-based</SelectItem>
                <SelectItem value="startup">Startup</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Target Role</Label>
            <Select value={form.target_role} onValueChange={(v) => setForm((f) => ({ ...f, target_role: v }))}>
              <SelectTrigger className="h-12 bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      ),
    },
    {
      icon: <Clock className="h-8 w-8 text-level-cyan" />,
      title: "Schedule",
      content: (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Daily Study Hours</Label>
            <Select value={String(form.daily_study_hours)} onValueChange={(v) => setForm((f) => ({ ...f, daily_study_hours: Number(v) }))}>
              <SelectTrigger className="h-12 bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 8].map((h) => <SelectItem key={h} value={String(h)}>{h} hour{h > 1 ? "s" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Placement Timeline</Label>
            <Select value={form.placement_timeline} onValueChange={(v) => setForm((f) => ({ ...f, placement_timeline: v }))}>
              <SelectTrigger className="h-12 bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1 month">1 month</SelectItem>
                <SelectItem value="3 months">3 months</SelectItem>
                <SelectItem value="6 months">6 months</SelectItem>
                <SelectItem value="12 months">12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg glass rounded-2xl p-8"
      >
        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "gradient-primary" : "bg-secondary"}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-3 mb-6">
              {steps[step].icon}
              <h2 className="text-2xl font-bold">{steps[step].title}</h2>
            </div>
            {steps[step].content}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-8">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} className="gradient-primary text-primary-foreground">
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading} className="gradient-primary text-primary-foreground">
              {loading ? "Setting up..." : "Launch 🚀"}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Onboarding;
