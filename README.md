# BooBooBuddy
For Concordia's 2026 Hackathon


### High-level architecture
```

┌─────────────┐
│   Frontend  │  Next.js (React + TS + Tailwind)
│             │
│  Chat UI    │◄───────────────┐
│  Voice UI   │                │
└─────▲───────┘                │
      │ JSON (strict schemas)  │
      ▼                        │
┌─────────────┐                │
│   Backend   │  Next.js API routes / Edge functions
│             │
│  LLM Orchestration ──┐       │
│  Clinic Search       │       │
│  Telephony Control   │       │
│  User/Auth/Profile   │       │
└─────▲─────────────── ┘       │
      │                        │
      ▼                        │
┌─────────────┐                │
│ PostgreSQL  │◄───────────────┘
│ (User,      │
│  Health,    │
│  Sessions)  │
└─────────────┘


```
