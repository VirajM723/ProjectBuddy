# Project Buddy

A full-stack developer collaboration platform that enables users to discover projects, collaborate with others, and track contributions in one place.

---

## Features

### Authentication and Authorization
- Secure login and signup using JWT
- Protected routes with role-based access control

### Project Management
- Create, explore, and manage projects
- Define tech stack, roles, and commitment levels

### Collaboration System
- Apply to projects through collaboration requests
- Accept or reject applicants as a project owner

### Contribution Tracking
- GitHub-style heatmap visualization using D3.js
- Track daily activity and project involvement

### Skill Endorsements
- Endorse skills of other users
- Build credibility within the platform

### User Profiles
- Custom profiles with bio and external links
- View projects, endorsements, and activity logs

---

## Tech Stack

### Frontend
- React (TypeScript)
- Vite
- Tailwind CSS
- Framer Motion
- D3.js
- Axios

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- bcryptjs

---

## Project Structure

```
project-buddy/
│── src/
│   ├── components/      # Reusable UI components
│   ├── pages/           # Application pages
│   ├── services/        # API layer (Axios)
│   ├── server/          # Backend logic
│   │   ├── models/      # Mongoose schemas
│   │   ├── routes/      # API routes
│   │   └── middleware/  # Authentication middleware
│   ├── App.tsx
│   └── main.tsx
│
│── server.ts            # Express entry point
│── vite.config.ts
│── package.json
│── tsconfig.json
│── .env.example
```

---

## Installation and Setup

### 1. Clone the repository
```bash
git clone https://github.com/VirajM723/ProjectBuddy.git
cd project-buddy
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file:

```
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_secret_key
```

### 4. Run the application
```bash
npm run dev
```

The application runs on http://localhost:3000

---

## API Overview

- /api/auth – Authentication (login, register)
- /api/projects – Project CRUD operations
- /api/users – User profile management
- /api/collaborations – Collaboration requests
- /api/endorsements – Skill endorsements
- /api/logs – Contribution logs

---
