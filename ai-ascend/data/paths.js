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
    durationHours: 36,
    description: "Complete backend roadmap from fundamentals to Spring Boot microservices projects.",
    tags: ["api", "databases", "spring-boot", "microservices", "architecture", "networking"],
    videos: [
      {
        id: "backend-1",
        title: "Frontend",
        durationMin: 120,
        url: "https://youtu.be/7dSJubxFWv0?si=mH2JxxqaAklAJjeH",
        tags: ["frontend", "basics"]
      },
      {
        id: "backend-2",
        title: "What is Backend",
        durationMin: 90,
        url: "https://youtu.be/XBu54nfzxAQ?si=4C2Ckmy8-jYC23Im",
        tags: ["backend", "fundamentals"]
      },
      {
        id: "backend-3",
        title: "Networking Basics",
        durationMin: 110,
        url: "https://youtu.be/IPvYjXCsTg8?si=FCYPT5BNkeC3QKOg",
        tags: ["networking", "basics"]
      },
      {
        id: "backend-4",
        title: "Client-Server Architecture",
        durationMin: 90,
        url: "https://youtu.be/yioOQ4ItYuo?si=3P-IDOtq48aSARo5",
        tags: ["client-server", "architecture"]
      },
      {
        id: "backend-5",
        title: "Monolith vs Microservices Architecture",
        durationMin: 90,
        url: "https://youtu.be/NdeTGlZ__Do?si=1nLhabVxkwkFcmJV",
        tags: ["monolith", "microservices", "architecture"]
      },
      {
        id: "backend-6",
        title: "How to Choose a Backend Framework",
        durationMin: 80,
        url: "https://youtu.be/nVPkwGqhfQI?si=GuRioZElvzNQ_rbi",
        tags: ["frameworks", "backend"]
      },
      {
        id: "backend-7",
        title: "How to Choose Database for a Project",
        durationMin: 80,
        url: "https://youtu.be/kkeFE6iRfMM?si=bpOsTP-gYiBiIdaW",
        tags: ["databases", "system-design"]
      },
      {
        id: "backend-8",
        title: "Spring Boot Framework",
        durationMin: 360,
        url: "https://youtube.com/playlist?list=PLsyeobzWxl7qbKoSgR5ub6jolI8-ocxCF&si=k2aE9QiU_DFYT--6",
        tags: ["spring-boot", "java", "framework"]
      },
      {
        id: "backend-9",
        title: "Microservice Project Tutorial using Spring Boot",
        durationMin: 420,
        url: "https://youtube.com/playlist?list=PLSVW22jAG8pDeU80nDzbUgr8qqzEMppi8&si=0dwa7rzD3SdRCNj-",
        tags: ["spring-boot", "microservices", "project"]
      }
    ]
  },
  {
    id: "cybersecurity",
    title: "Cybersecurity Engineer",
    role: "Security Ops",
    level: "Intermediate",
    durationHours: 42,
    description: "Comprehensive cybersecurity roadmap from security and networking foundations to SOC, pentesting, and practical projects.",
    tags: ["cybersecurity", "network-security", "ethical-hacking", "pentesting", "soc", "cloud-security", "linux", "python"],
    videos: [
      {
        id: "cybersecurity-1",
        title: "Introduction to Cybersecurity",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=inWWhr5tnEA",
        tags: ["security-basics", "cia-triad", "attacks"]
      },
      {
        id: "cybersecurity-2",
        title: "Networking Fundamentals",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=qiQR5rTSshw",
        tags: ["tcp-ip", "osi", "dns", "ports", "protocols"]
      },
      {
        id: "cybersecurity-3",
        title: "Linux Fundamentals",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=sWbUDq4S6Y8",
        tags: ["linux", "commands", "permissions"]
      },
      {
        id: "cybersecurity-4",
        title: "Programming for Security (Python)",
        durationMin: 240,
        url: "https://www.youtube.com/watch?v=_uQrJ0TkZlc",
        tags: ["python", "scripting", "automation"]
      },
      {
        id: "cybersecurity-5",
        title: "Web Security Basics",
        durationMin: 110,
        url: "https://www.youtube.com/watch?v=3Kq1MIfTWCE",
        tags: ["http", "cookies", "auth", "sessions", "web-security"]
      },
      {
        id: "cybersecurity-6",
        title: "Ethical Hacking Fundamentals",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=3Kq1MIfTWCE",
        tags: ["footprinting", "scanning", "enumeration", "vulnerability-analysis"]
      },
      {
        id: "cybersecurity-7",
        title: "Penetration Testing",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=2TofunAI6fU",
        tags: ["pentesting", "exploitation", "reporting"]
      },
      {
        id: "cybersecurity-8",
        title: "Security Tools (Kali Linux)",
        durationMin: 130,
        url: "https://www.youtube.com/watch?v=lZAoFs75_cs",
        tags: ["kali-linux", "nmap", "wireshark", "burp-suite", "metasploit"]
      },
      {
        id: "cybersecurity-9",
        title: "Cryptography",
        durationMin: 110,
        url: "https://www.youtube.com/watch?v=6-JjHa-qLPk",
        tags: ["encryption", "hashing", "keys", "cryptography"]
      },
      {
        id: "cybersecurity-10",
        title: "Network Security",
        durationMin: 110,
        url: "https://www.youtube.com/watch?v=O5nHhN7Jk1Y",
        tags: ["firewalls", "ids", "ips", "vpn"]
      },
      {
        id: "cybersecurity-11",
        title: "Cloud Security",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=ulprqHHWlng",
        tags: ["iam", "cloud-architecture", "aws-security"]
      },
      {
        id: "cybersecurity-12",
        title: "Security Monitoring (SOC)",
        durationMin: 100,
        url: "https://www.youtube.com/watch?v=2s7h1xC8Y1A",
        tags: ["soc", "siem", "incident-response", "log-monitoring"]
      },
      {
        id: "cybersecurity-13",
        title: "Capture The Flag (CTF) Practice",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=U_P23SqJaDc",
        tags: ["ctf", "practice", "hacking-challenges"]
      },
      {
        id: "cybersecurity-14",
        title: "Build Cybersecurity Projects",
        durationMin: 130,
        url: "https://www.youtube.com/watch?v=3Kq1MIfTWCE",
        tags: ["projects", "network-scanner", "password-checker", "vulnerability-scanner"]
      }
    ]
  },
  {
    id: "aiml",
    title: "AI/ML Engineer",
    role: "AI Development",
    level: "Intermediate",
    durationHours: 44,
    description: "Comprehensive AI/ML roadmap from Python and math fundamentals to deep learning, deployment, MLOps, and portfolio projects.",
    tags: ["python", "machine-learning", "deep-learning", "nlp", "computer-vision", "mlops", "data-analysis"],
    videos: [
      {
        id: "aiml-1",
        title: "Programming Fundamentals (Python)",
        durationMin: 240,
        url: "https://www.youtube.com/watch?v=_uQrJ0TkZlc",
        tags: ["python", "programming", "fundamentals"]
      },
      {
        id: "aiml-2",
        title: "Mathematics for Machine Learning",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=aircAruvnKk",
        tags: ["linear-algebra", "probability", "statistics", "calculus"]
      },
      {
        id: "aiml-3",
        title: "Data Analysis & Visualization",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=r-uOLxNrNk8",
        tags: ["numpy", "pandas", "matplotlib", "seaborn"]
      },
      {
        id: "aiml-4",
        title: "Data Preprocessing",
        durationMin: 100,
        url: "https://www.youtube.com/watch?v=0Lt9w-BxKFQ",
        tags: ["data-cleaning", "feature-engineering", "missing-data"]
      },
      {
        id: "aiml-5",
        title: "Machine Learning Fundamentals",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=7eh4d6sabA0",
        tags: ["supervised", "unsupervised", "model-evaluation"]
      },
      {
        id: "aiml-6",
        title: "Machine Learning Algorithms",
        durationMin: 130,
        url: "https://www.youtube.com/watch?v=i_LwzRVP7bg",
        tags: ["linear-regression", "decision-trees", "random-forest", "svm"]
      },
      {
        id: "aiml-7",
        title: "Deep Learning Basics",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=aircAruvnKk",
        tags: ["neural-networks", "activation-functions", "backpropagation"]
      },
      {
        id: "aiml-8",
        title: "Deep Learning Frameworks",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=tPYj3fFJGjk",
        tags: ["tensorflow", "pytorch", "keras"]
      },
      {
        id: "aiml-9",
        title: "Natural Language Processing (NLP)",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=CMrHM8a3hqw",
        tags: ["nlp", "text-processing", "transformers"]
      },
      {
        id: "aiml-10",
        title: "Computer Vision",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=ArPaAX_PhIs",
        tags: ["computer-vision", "cnn", "object-detection"]
      },
      {
        id: "aiml-11",
        title: "Model Deployment",
        durationMin: 110,
        url: "https://www.youtube.com/watch?v=UbCWoMf80PY",
        tags: ["deployment", "apis", "flask", "fastapi"]
      },
      {
        id: "aiml-12",
        title: "MLOps",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=9BgIDqAzfuA",
        tags: ["mlops", "model-versioning", "cicd", "monitoring"]
      },
      {
        id: "aiml-13",
        title: "AI Projects & Portfolio",
        durationMin: 130,
        url: "https://www.youtube.com/watch?v=JMUxmLyrhSk",
        tags: ["projects", "chatbots", "recommendation-systems", "image-classifiers"]
      }
    ]
  },
  {
    id: "cloud",
    title: "Cloud Engineer",
    role: "Cloud Ops",
    level: "Advanced",
    durationHours: 48,
    description: "Complete cloud engineer roadmap from networking and Linux fundamentals to AWS, Terraform, Kubernetes, security, and real deployments.",
    tags: ["cloud", "aws", "networking", "terraform", "docker", "kubernetes", "cicd", "security"],
    videos: [
      {
        id: "cloud-1",
        title: "Internet & Networking Basics",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=qiQR5rTSshw",
        tags: ["internet", "networking", "basics"]
      },
      {
        id: "cloud-2",
        title: "Linux Fundamentals",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=sWbUDq4S6Y8",
        tags: ["linux", "os", "fundamentals"]
      },
      {
        id: "cloud-3",
        title: "Programming Basics (Python)",
        durationMin: 240,
        url: "https://www.youtube.com/watch?v=_uQrJ0TkZlc",
        tags: ["python", "programming", "basics"]
      },
      {
        id: "cloud-4",
        title: "Version Control (Git & GitHub)",
        durationMin: 100,
        url: "https://www.youtube.com/watch?v=RGOj5yH7evk",
        tags: ["git", "github", "version-control"]
      },
      {
        id: "cloud-5",
        title: "Cloud Computing Fundamentals",
        durationMin: 140,
        url: "https://www.youtube.com/watch?v=3hLmDS179YE",
        tags: ["cloud", "fundamentals"]
      },
      {
        id: "cloud-6",
        title: "AWS Fundamentals",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=ulprqHHWlng",
        tags: ["aws", "fundamentals"]
      },
      {
        id: "cloud-7",
        title: "Core AWS Services (EC2, S3, IAM, VPC)",
        durationMin: 150,
        url: "https://www.youtube.com/watch?v=Ia-UEYYR44s",
        tags: ["aws", "ec2", "s3", "iam", "vpc"]
      },
      {
        id: "cloud-8",
        title: "Networking in AWS (VPC, Subnets, Security Groups)",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=bGDmeTZYtE8",
        tags: ["aws", "vpc", "subnets", "security-groups"]
      },
      {
        id: "cloud-9",
        title: "Infrastructure as Code (Terraform)",
        durationMin: 140,
        url: "https://www.youtube.com/watch?v=l5k1ai_GBDE",
        tags: ["terraform", "iac"]
      },
      {
        id: "cloud-10",
        title: "Containers (Docker)",
        durationMin: 110,
        url: "https://www.youtube.com/watch?v=fqMOX6JJhGo",
        tags: ["docker", "containers"]
      },
      {
        id: "cloud-11",
        title: "Container Orchestration (Kubernetes)",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=X48VuDVv0do",
        tags: ["kubernetes", "orchestration"]
      },
      {
        id: "cloud-12",
        title: "CI/CD Pipelines",
        durationMin: 120,
        url: "https://www.youtube.com/watch?v=scEDHsr3APg",
        tags: ["cicd", "devops"]
      },
      {
        id: "cloud-13",
        title: "Monitoring & Logging",
        durationMin: 100,
        url: "https://www.youtube.com/watch?v=2Yy2O9c4uS0",
        tags: ["monitoring", "logging", "observability"]
      },
      {
        id: "cloud-14",
        title: "Cloud Security Basics",
        durationMin: 100,
        url: "https://www.youtube.com/watch?v=Q0W0Yl3o2z0",
        tags: ["security", "cloud-security"]
      },
      {
        id: "cloud-15",
        title: "Deploying Real Cloud Projects",
        durationMin: 150,
        url: "https://www.youtube.com/watch?v=KzBf9ZtQ3yY",
        tags: ["deployment", "projects", "cloud"]
      }
    ]
  }
]

export const PATHS_BY_ID = PATHS.reduce((acc, item) => {
  acc[item.id] = item
  return acc
}, {})
