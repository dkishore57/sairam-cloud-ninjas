import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { skills, skill_level, dream_company_type, target_role, daily_study_hours, placement_timeline } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `You are an expert placement preparation coach. Generate a personalized 12-week placement preparation roadmap as JSON.

User Profile:
- Skills: ${(skills || []).join(", ") || "None specified"}
- Skill Level: ${skill_level || "beginner"}
- Dream Company Type: ${dream_company_type || "product"}
- Target Role: ${target_role || "Software Development Engineer"}
- Daily Study Hours: ${daily_study_hours || 2}
- Placement Timeline: ${placement_timeline || "3 months"}

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "weeks": [
    {
      "week": 1,
      "title": "Week title",
      "topics": ["topic1", "topic2"],
      "problems": ["problem1", "problem2", "problem3"],
      "resources": [
        {"type": "youtube", "title": "Video title", "url": "https://youtube.com/..."},
        {"type": "article", "title": "Article title", "url": "https://..."},
        {"type": "practice", "title": "Platform", "url": "https://..."}
      ]
    }
  ]
}

Generate all 12 weeks. Make it specific to the user's target role and company type. Focus on their weak areas based on skill level. Include real, commonly recommended resources.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a placement preparation expert. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) throw new Error("No content returned from AI");

    // Parse JSON - handle potential markdown code blocks
    let roadmap;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      roadmap = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse roadmap data");
    }

    return new Response(JSON.stringify({ roadmap }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-roadmap error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
