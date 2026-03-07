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
        url: "https://youtube.com/playlist?list=PLdpzxOOAlwvIBIRWcReRV-m2kgIW6V6gr",
        tags: ["linux", "bash"]
      },
      {
        id: "devops-topic-2",
        title: "SDLC",
        durationMin: 90,
        url: "https://youtu.be/jRqBIpcgO4g?si=lqH8ZJXjXbABb8j8",
        tags: ["sdlc"]
      },
      {
        id: "devops-topic-3",
        title: "AWS Services",
        durationMin: 140,
        url: "https://youtube.com/playlist?list=PLdpzxOOAlwvLNOxX0RfndiYSt1Le9azze&si=NyjcbUPO9_chZ2Yj",
        tags: ["aws", "cloud"]
      },
      {
        id: "devops-topic-4",
        title: "Docker",
        durationMin: 110,
        url: "https://youtu.be/3c-iBn73dDE?si=o9hJFKIuWNtkVjN8",
        tags: ["docker", "containers"]
      },
      {
        id: "devops-topic-5",
        title: "Kubernetes",
        durationMin: 120,
        url: "https://youtube.com/playlist?list=PLdpzxOOAlwvJdsW6A0jCz_3VaANuFMLpc&si=K3E122uJ4Cx5Va36",
        tags: ["kubernetes", "k8s"]
      },
      {
        id: "devops-topic-6",
        title: "CI/CD with GitHub Actions",
        durationMin: 100,
        url: "https://youtu.be/R8_veQiYBjI?si=Ze8L3mwGAxcoplVA",
        tags: ["cicd", "github-actions"]
      },
      {
        id: "devops-topic-7",
        title: "Terraform",
        durationMin: 110,
        url: "https://youtube.com/playlist?list=PLdpzxOOAlwvI0O4PeKVV1-yJoX2AqIWuf&si=amj33ZAscBnbJ7Cq",
        tags: ["terraform", "iac"]
      },
      {
        id: "devops-topic-8",
        title: "Project 1: Deploying a Three-Tier Web Architecture in UI and Terraform",
        durationMin: 150,
        url: "https://youtu.be/amiIcyt-J2A?si=2_8AV9b_wDjotxvk",
        tags: ["projects", "terraform", "three-tier"]
      },
      {
        id: "devops-topic-9",
        title: "Project 2: CI/CD Pipeline with Kubernetes and GitHub Actions",
        durationMin: 150,
        url: "https://youtu.be/JGQI5pkK82w?si=uwrcODQakvT4HKdU",
        tags: ["projects", "cicd", "kubernetes", "github-actions"]
      },
      {
        id: "devops-topic-10",
        title: "Project 3: AWS EKS Deployment of the Three-Tier Web App",
        durationMin: 150,
        url: "https://youtu.be/RRCrY12VY_s?si=tmDX619Bh1SVDbHU",
        tags: ["projects", "aws", "eks", "three-tier"]
      }
    ]
  },
  {
    id: "frontend",
    title: "Frontend Developer",
    role: "Web UI",
    level: "Beginner",
    durationHours: 36,
    description: "Complete frontend roadmap from internet basics to React, Tailwind, and API integration.",
    tags: ["ui", "javascript", "css", "react", "tailwind", "api", "git"],
    videos: [
      {
        id: "frontend-1",
        title: "Internet Basics",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=7_LPdttKXPc",
        tags: ["internet", "fundamentals"]
      },
      {
        id: "frontend-2",
        title: "HTML Fundamentals",
        durationMin: 120,
        url: "https://youtu.be/HD13eq_Pmp8?si=sZDe5SmHIGDbjuCy",
        tags: ["html", "fundamentals"]
      },
      {
        id: "frontend-3",
        title: "CSS Fundamentals",
        durationMin: 120,
        url: "https://youtu.be/HGTJBPNC-Gw?si=WPZrj7ZfNAHB8oPW",
        tags: ["css", "fundamentals"]
      },
      {
        id: "frontend-4",
        title: "JavaScript Basics",
        durationMin: 120,
        url: "https://youtu.be/lfmg-EJ8gm4?si=N4Gpi_bzdRt6CE-d",
        tags: ["javascript", "basics"]
      },
      {
        id: "frontend-5",
        title: "Version Control (Git & GitHub)",
        durationMin: 120,
        url: "https://youtu.be/apGV9Kg7ics?si=as-ahWRgYH6obyCn",
        tags: ["git", "github", "version-control"]
      },
      {
        id: "frontend-6",
        title: "Package Managers & Build Tools",
        durationMin: 120,
        url: "https://youtu.be/jHDhaSSKmB0?si=7zJU19nnYj0GaFBD",
        tags: ["npm", "build-tools", "bundlers"]
      },
      {
        id: "frontend-7",
        title: "Frontend Framework (React)",
        durationMin: 120,
        url: "https://youtu.be/TtPXvEcE11E?si=fPvkPV7-rA5gXQqe",
        tags: ["react", "frontend-framework"]
      },
      {
        id: "frontend-8",
        title: "Styling Frameworks (Tailwind)",
        durationMin: 120,
        url: "https://youtu.be/tS7upsfuxmo?si=5I_1TmlTcnCnCj2L",
        tags: ["tailwind", "styling"]
      },
      {
        id: "frontend-9",
        title: "API Integration",
        durationMin: 120,
        url: "https://youtu.be/Oive66jrwBs?si=h7c6AAUcr13sqdRf",
        tags: ["api", "integration", "fetch"]
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
