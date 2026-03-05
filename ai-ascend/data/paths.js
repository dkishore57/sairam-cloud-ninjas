export const PATHS = [
  {
    id: "devops",
    title: "DevOps Engineer",
    role: "Platform",
    level: "Beginner",
    durationHours: 24,
    description: "Core DevOps roadmap with main topics from Linux to Terraform and projects.",
    tags: ["ci-cd", "automation", "infra", "linux", "aws", "docker", "kubernetes", "terraform"],
    videos: [
      {
        id: "devops-topic-1",
        title: "Linux and Bash",
        durationMin: 120,
        url: "",
        tags: ["linux", "bash"]
      },
      {
        id: "devops-topic-2",
        title: "SDLC",
        durationMin: 90,
        url: "",
        tags: ["sdlc"]
      },
      {
        id: "devops-topic-3",
        title: "AWS Services",
        durationMin: 140,
        url: "",
        tags: ["aws", "cloud"]
      },
      {
        id: "devops-topic-4",
        title: "Docker",
        durationMin: 110,
        url: "",
        tags: ["docker", "containers"]
      },
      {
        id: "devops-topic-5",
        title: "Kubernetes",
        durationMin: 120,
        url: "",
        tags: ["kubernetes", "k8s"]
      },
      {
        id: "devops-topic-6",
        title: "CI/CD with GitHub Actions",
        durationMin: 100,
        url: "",
        tags: ["cicd", "github-actions"]
      },
      {
        id: "devops-topic-7",
        title: "Terraform",
        durationMin: 110,
        url: "",
        tags: ["terraform", "iac"]
      },
      {
        id: "devops-topic-8",
        title: "Projects",
        durationMin: 150,
        url: "",
        tags: ["projects", "capstone"]
      }
    ]
  },
  {
    id: "frontend",
    title: "Frontend Developer",
    role: "Web UI",
    level: "Beginner",
    durationHours: 14,
    description: "Responsive UI design, JavaScript fundamentals, and modern frontend practices.",
    tags: ["ui", "javascript", "css"],
    videos: [
      {
        id: "frontend-1",
        title: "Frontend Development Roadmap",
        durationMin: 110,
        url: "https://www.youtube.com/embed/dGcsHMXbSOA",
        tags: ["frontend", "roadmap"]
      }
    ]
  },
  {
    id: "backend",
    title: "Backend Developer",
    role: "API Services",
    level: "Intermediate",
    durationHours: 18,
    description: "Server-side architecture, API design, and production data handling.",
    tags: ["api", "databases", "security"],
    videos: [
      {
        id: "backend-1",
        title: "Backend Development Crash Course",
        durationMin: 130,
        url: "https://www.youtube.com/embed/Oe421EPjeBE",
        tags: ["nodejs", "backend"]
      }
    ]
  },
  {
    id: "cloud",
    title: "Cloud Engineer",
    role: "Cloud Ops",
    level: "Advanced",
    durationHours: 20,
    description: "Cloud infrastructure, scaling, reliability, and deployment strategies.",
    tags: ["aws", "cloud", "reliability"],
    videos: [
      {
        id: "cloud-1",
        title: "Cloud Computing Full Course",
        durationMin: 140,
        url: "https://www.youtube.com/embed/3hLmDS179YE",
        tags: ["cloud", "infra"]
      }
    ]
  }
]

export const PATHS_BY_ID = PATHS.reduce((acc, item) => {
  acc[item.id] = item
  return acc
}, {})
