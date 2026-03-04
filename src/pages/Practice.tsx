import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Clock, BookOpen, Brain, MessageSquare, Code, Timer } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Question = Tables<"questions">;
type QuestionProgress = Tables<"user_question_progress">;

const categories = [
  { key: "dsa", label: "DSA", icon: Code },
  { key: "aptitude", label: "Aptitude", icon: Brain },
  { key: "core_cs", label: "Core CS", icon: BookOpen },
  { key: "hr", label: "HR", icon: MessageSquare },
];

const Practice = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [progress, setProgress] = useState<Record<string, QuestionProgress>>({});
  const [activeQ, setActiveQ] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    supabase.from("questions").select("*").then(({ data }) => {
      if (data) setQuestions(data);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_question_progress").select("*").eq("user_id", user.id)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, QuestionProgress> = {};
          data.forEach((p) => { map[p.question_id] = p; });
          setProgress(map);
        }
      });
  }, [user]);

  // Timer
  useEffect(() => {
    let interval: any;
    if (timerActive) {
      interval = setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  const startQuestion = (q: Question) => {
    setActiveQ(q);
    setSelectedAnswer("");
    setNotes(progress[q.id]?.notes || "");
    setShowAnswer(false);
    setTimer(0);
    setTimerActive(true);
  };

  const submitAnswer = async () => {
    if (!user || !activeQ) return;
    setTimerActive(false);
    setShowAnswer(true);

    const isCorrect = selectedAnswer === activeQ.correct_answer;
    try {
      await supabase.from("user_question_progress").upsert({
        user_id: user.id,
        question_id: activeQ.id,
        completed: true,
        correct: isCorrect,
        notes,
        time_spent_seconds: timer,
      }, { onConflict: "user_id,question_id" });

      setProgress((p) => ({
        ...p,
        [activeQ.id]: {
          ...p[activeQ.id],
          id: p[activeQ.id]?.id || "",
          user_id: user.id,
          question_id: activeQ.id,
          completed: true,
          correct: isCorrect,
          notes,
          time_spent_seconds: timer,
          attempted_at: new Date().toISOString(),
        },
      }));

      toast.success(isCorrect ? "Correct! 🎉" : "Incorrect. Review the explanation.");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (activeQ) {
    const options = (activeQ.options as string[]) || [];
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => { setActiveQ(null); setTimerActive(false); }} className="mb-4">← Back</Button>

          <Card className="shadow-card border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{activeQ.category.toUpperCase()}</Badge>
                  <Badge className={activeQ.difficulty === "easy" ? "bg-success/20 text-success" : activeQ.difficulty === "medium" ? "bg-warning/20 text-warning" : "bg-destructive/20 text-destructive"}>
                    {activeQ.difficulty}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground font-mono">
                  <Timer className="h-4 w-4" />
                  {formatTime(timer)}
                </div>
              </div>
              <CardTitle className="mt-4">{activeQ.title}</CardTitle>
              {activeQ.description && <p className="text-muted-foreground mt-2">{activeQ.description}</p>}
            </CardHeader>
            <CardContent className="space-y-4">
              {options.length > 0 && (
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => !showAnswer && setSelectedAnswer(opt)}
                      disabled={showAnswer}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        showAnswer
                          ? opt === activeQ.correct_answer
                            ? "border-success bg-success/10"
                            : opt === selectedAnswer
                            ? "border-destructive bg-destructive/10"
                            : "border-border"
                          : selectedAnswer === opt
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {showAnswer && activeQ.explanation && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-lg bg-secondary">
                  <p className="text-sm font-medium mb-1">Explanation</p>
                  <p className="text-sm text-muted-foreground">{activeQ.explanation}</p>
                </motion.div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add your notes..." className="bg-secondary" />
              </div>

              {!showAnswer ? (
                <Button onClick={submitAnswer} disabled={!selectedAnswer} className="w-full gradient-primary text-primary-foreground">
                  Submit Answer
                </Button>
              ) : (
                <Button onClick={() => { setActiveQ(null); setTimerActive(false); }} className="w-full" variant="outline">
                  Next Question
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold mb-2">Question Bank</h1>
      <p className="text-muted-foreground mb-6">Practice categorized questions with timer and tracking</p>

      {questions.length === 0 ? (
        <Card className="shadow-card border-border/50">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">No questions yet</p>
            <p className="text-muted-foreground">Questions will appear here once they're added to the database.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="dsa">
          <TabsList className="mb-6 bg-secondary">
            {categories.map((c) => (
              <TabsTrigger key={c.key} value={c.key} className="flex items-center gap-1.5">
                <c.icon className="h-4 w-4" /> {c.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((cat) => (
            <TabsContent key={cat.key} value={cat.key}>
              <div className="space-y-3">
                {questions.filter((q) => q.category === cat.key).map((q, i) => {
                  const prog = progress[q.id];
                  return (
                    <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card
                        className="shadow-card border-border/50 cursor-pointer hover:border-primary/30 transition-all"
                        onClick={() => startQuestion(q)}
                      >
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {prog?.completed ? (
                              <CheckCircle2 className={`h-5 w-5 ${prog.correct ? "text-success" : "text-destructive"}`} />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground" />
                            )}
                            <div>
                              <p className="font-medium">{q.title}</p>
                              <div className="flex gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">{q.difficulty}</Badge>
                                {q.tags?.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                              </div>
                            </div>
                          </div>
                          {prog?.time_spent_seconds && (
                            <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {formatTime(prog.time_spent_seconds)}
                            </span>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </DashboardLayout>
  );
};

export default Practice;
