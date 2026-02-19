# TradeApp - Service Marketplace MVP

An Uber-style marketplace connecting service professionals (plumbers, electricians, HVAC technicians, etc.) with customers who need work done.

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript
- **Backend**: Node.js + Express + Socket.io
- **Database**: PostgreSQL with PostGIS (for location features)
- **Architecture**: Monorepo with npm workspaces

## Prerequisites

Before running the application, make sure you have installed:

1. **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
2. **Docker Desktop** (for PostgreSQL) - [Download](https://www.docker.com/products/docker-desktop/)
   - Alternatively, you can install PostgreSQL with PostGIS directly

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

This will install all dependencies for the frontend, backend, and shared packages.

### 2. Set Up the Database

Start PostgreSQL with PostGIS using Docker:

```bash
docker-compose up -d
```

This will:
- Start PostgreSQL with PostGIS extension
- Create the `tradeapp` database
- Run the initial schema migration

To verify the database is running:

```bash
docker ps
```

You should see a container named `tradeapp-postgres` running.

### 3. Environment Variables

The `.env` file is already configured with default development values. You can modify it if needed:

```env
DATABASE_URL=postgresql://tradeapp:tradeapp@localhost:5432/tradeapp
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-abc123xyz789
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

**Important**: Change `JWT_SECRET` before deploying to production!

### 4. Run the Application

#### Option A: Run both frontend and backend together

```bash
npm run dev
```

This will start:
- Backend API at http://localhost:3000
- Frontend at http://localhost:5173

#### Option B: Run frontend and backend separately

In separate terminals:

```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

### 5. Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## Project Structure

```
TradeApp/
├── packages/
│   ├── frontend/          # React application
│   │   ├── src/
│   │   │   ├── components/    # React components
│   │   │   ├── context/       # Auth & Socket contexts
│   │   │   ├── pages/         # Page components
│   │   │   ├── services/      # API services
│   │   │   └── App.tsx        # Main app with routing
│   │   └── package.json
│   ├── backend/           # Node.js + Express API
│   │   ├── src/
│   │   │   ├── config/        # Database configuration
│   │   │   ├── controllers/   # Request handlers
│   │   │   ├── middleware/    # Auth & error handling
│   │   │   ├── routes/        # API routes
│   │   │   ├── db/migrations/ # Database schema
│   │   │   └── server.ts      # Express server
│   │   └── package.json
│   └── shared/            # Shared TypeScript types
│       ├── src/types/         # Type definitions
│       └── package.json
├── docker-compose.yml     # PostgreSQL container
├── .env                   # Environment variables
└── package.json           # Root workspace config
```

## Features Implemented (Phase 1)

✅ **Authentication**
- User registration (Customer & Professional)
- Login with JWT tokens
- Protected routes
- User session management

✅ **Database**
- PostgreSQL with PostGIS (for location features)
- Complete schema with migrations
- User and professional profile tables
- Job, rating, message, and notification tables

✅ **Backend API**
- RESTful API with Express
- JWT authentication middleware
- Rate limiting
- Security headers (Helmet)
- CORS configuration
- Socket.io integration (ready for real-time features)

✅ **Frontend**
- React 19 with TypeScript
- React Router for navigation
- Auth Context for global state
- Login and registration forms
- Protected dashboard
- Responsive layout

## What's Next (Upcoming Phases)

🚧 **Phase 2**: Professional Profiles
- Profile setup for professionals
- Skills and service category selection
- Location picker with maps
- Availability settings

🚧 **Phase 3**: Job Management
- Job posting for customers
- Job browsing for professionals
- Location-based job matching
- Job acceptance and status tracking

🚧 **Phase 4**: Real-Time Features
- Live job notifications
- Socket.io event handling
- Real-time status updates

🚧 **Phase 5**: Messaging
- In-app chat between customers and professionals
- Real-time message delivery
- Message notifications

🚧 **Phase 6**: Rating System
- Post-job ratings
- Professional rating aggregation
- Review display

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Health
- `GET /health` - Server health check

## Troubleshooting

### Database connection failed

If you see "Database connection failed", make sure:
1. Docker is running (`docker ps` should show `tradeapp-postgres`)
2. Start the database: `docker-compose up -d`
3. Check the logs: `docker-compose logs postgres`

### Port already in use

If port 3000 or 5173 is already in use:
1. Stop other applications using these ports
2. Or change the ports in `.env` and `packages/frontend/vite.config.ts`

### npm install fails

If `npm install` fails:
1. Make sure you're using Node.js v18 or higher: `node --version`
2. Clear npm cache: `npm cache clean --force`
3. Delete `node_modules` and `package-lock.json`, then run `npm install` again

## Development Tips

### Database Management

View database:
```bash
docker exec -it tradeapp-postgres psql -U tradeapp -d tradeapp
```

Run SQL queries:
```sql
\dt                          -- List all tables
\d users                     -- Describe users table
SELECT * FROM users;         -- View all users
```

Stop database:
```bash
docker-compose down
```

Reset database (deletes all data):
```bash
docker-compose down -v
docker-compose up -d
```

### Build for Production

```bash
npm run build
```

This will build both frontend and backend for production deployment.

## Contributing

This is an MVP project. Future phases will include job posting, real-time notifications, messaging, and ratings.

## License

MIT
