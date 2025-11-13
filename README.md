# <image src="public/apple-touch-icon-ready.png" width="33px">  s1pper Dashboard

A fun, real-time dashboard for monitoring your Klipper/Moonraker 3D printer. Features live camera streaming, print status monitoring, temperature tracking, and an optional visitor guestbook! Primarily focused on the Ender 3 S1 Pro, but should work with other Klipper setups.

> 🐳 **Get started quickly** with the [Docker Deployment](#docker-deployment-recommended) guide.

## Features

- **Real-time Print Monitoring**: Live status updates, progress tracking, and time estimates
- **Camera Feed**: Live streaming and snapshot capture with privacy controls
- **Temperature Monitoring**: Real-time temperature charts for extruder and bed
- **Lifetime Statistics**: Track total print time, filament usage, and completed prints
- **Visitor Guestbook**: Optional database-powered guestbook for visitors (PostgreSQL)
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Graceful Degradation**: App works even when database features are unavailable

## Prerequisites

- Klipper 3D printer with Moonraker API enabled

**Docker Deployment (Recommended):**

- Docker and Docker Compose
- Klipper 3D printer with Moonraker API enabled

**Local Development:**

- Node.js 18+ and `pnpm`
- PostgreSQL database (optional, for guestbook features)

## Quick Start

### Docker Deployment (Recommended)

The easiest way to deploy the dashboard is using Docker. This method includes PostgreSQL and requires minimal setup.

1. **Clone the Repository**

```bash
git clone https://github.com/carmelosantana/s1pper-dashboard.git
cd s1pper-dashboard
```

2. **Configure Environment**

```bash
cp .env.example .env
```

Edit `.env` with your printer's IP address and secure password:

```env
PRINTER_HOST=192.168.1.123
MOONRAKER_PORT=7127
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Set a secure password!
POSTGRES_PASSWORD=your_secure_password_here
```

3. **Deploy with Docker**

Using Make (recommended):

```bash
make docker-up
```

Or using Docker Compose directly:

```bash
docker-compose up -d
```

Or using pnpm:

```bash
pnpm docker:deploy
```

4. **Access Dashboard**

Open [http://localhost:3000](http://localhost:3000) in your browser

The dashboard and database will start automatically. The database is initialized with the required tables on first run.

#### Docker Management Commands

Using Make:

```bash
make help                 # Show all available commands
make docker-up            # Start containers
make docker-down          # Stop containers
make docker-logs          # View logs
make docker-restart       # Restart containers
make docker-clean         # Remove containers and volumes
make docker-db-backup     # Backup database
make docker-db-restore    # Restore from latest backup
make test-api             # Test API endpoints with curl
```

Using pnpm:

```bash
pnpm docker:build         # Build Docker images
pnpm docker:up            # Start containers
pnpm docker:down          # Stop containers
pnpm docker:logs          # View logs
pnpm docker:restart       # Restart containers
pnpm docker:clean         # Remove everything
pnpm docker:deploy        # Build and deploy
```

#### Docker Troubleshooting

**Printer not accessible from container:**

If your printer is on the same machine as Docker, use your machine's IP address (not localhost) in `PRINTER_HOST`. Docker containers cannot access `localhost` on the host machine.

```bash
# Find your machine's IP
ip addr show | grep inet  # Linux
ifconfig | grep inet       # macOS
ipconfig                   # Windows
```

**Database connection issues:**

Check the database container is running:

```bash
docker ps | grep postgres
```

View database logs:

```bash
docker logs s1pper-postgres
```

**Reset everything:**

```bash
make docker-clean  # or: pnpm docker:clean
```

Then start fresh with `make docker-up`.

### Local Development

1. **Clone and Install**

```bash
git clone https://github.com/carmelosantana/s1pper-dashboard.git
cd s1pper-dashboard
pnpm install
```

2. **Configure Environment**

```bash
cp .env.example .env.local
```

Edit `.env.local` with your printer's IP address and other settings:

```env
PRINTER_HOST=192.168.1.123
MOONRAKER_PORT=7127
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. **Start Development Server**

```bash
pnpm dev
```

4. **Access Dashboard**

Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Configuration

### Required Variables

| Variable              | Description                   | Default                 |
| --------------------- | ----------------------------- | ----------------------- |
| `PRINTER_HOST`        | Your printer's IP address     | `192.168.1.123`         |
| `MOONRAKER_PORT`      | Moonraker API port            | `7127`                  |
| `NEXT_PUBLIC_APP_URL` | Application URL for API calls | `http://localhost:3000` |

### Optional Database Features

For guestbook and settings features, configure PostgreSQL:

| Variable             | Description                  | Default                  |
| -------------------- | ---------------------------- | ------------------------ |
| `DATABASE_URL`       | PostgreSQL connection string | None (features disabled) |
| `DATABASE_TIMEOUT`   | Connection timeout (ms)      | `2000`                   |
| `DATABASE_POOL_SIZE` | Connection pool size         | `20`                     |

### Optional Analytics

| Variable           | Description                |
| ------------------ | -------------------------- |
| `UMAMI_WEBSITE_ID` | Umami analytics website ID |
| `UMAMI_HOST_URL`   | Umami analytics host URL   |

## Database Setup (Optional)

The guestbook feature requires PostgreSQL. The app will work without it, but database-dependent features will be disabled.

1. **Setup PostgreSQL Database**

```sql
CREATE DATABASE guestbook;
CREATE USER guestbook WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE guestbook TO guestbook;
```

2. **Configure DATABASE_URL**

```env
DATABASE_URL=postgresql://guestbook:your_password@192.168.1.254:5432/guestbook
```

3. **Initialize Database** (automatic on first use)

```bash
node scripts/sql-runner.js
```

## Development

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

### Database Management

Use the SQL runner for database operations:

```bash
# Interactive SQL console
node scripts/sql-runner.js

# Initialize database tables
echo '.init' | node scripts/sql-runner.js

# Add sample data
echo '.sample' | node scripts/sql-runner.js

# View recent entries
echo '.recent' | node scripts/sql-runner.js
```

## Deployment

### Environment-Specific Configuration

**Production:**

```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
PRINTER_HOST=your.printer.ip
DATABASE_URL=postgresql://user:pass@host:port/db
```

**Development:**

```env
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Graceful Degradation

The application is designed to work even when components are unavailable:

- **No Database**: Guestbook features are hidden, settings default to public mode
- **Printer Offline**: Shows offline status with last known information
- **Camera Unavailable**: Shows placeholder with error message

## API Endpoints

| Endpoint                           | Method   | Description                                |
| ---------------------------------- | -------- | ------------------------------------------ |
| `/api/printer/status`              | GET      | Current printer status                     |
| `/api/printer/temperature-history` | GET      | Temperature data over time                 |
| `/api/printer/lifetime-stats`      | GET      | Lifetime statistics                        |
| `/api/camera/info`                 | GET      | Camera configuration                       |
| `/api/camera/snapshot`             | GET      | Current camera snapshot                    |
| `/api/camera/stream`               | GET      | Live camera stream                         |
| `/api/guestbook`                   | GET/POST | Guestbook entries (if database available)  |
| `/api/settings`                    | GET/PUT  | Dashboard settings (if database available) |

## License

This project is licensed under the [Creative Commons Attribution 4.0 International License (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
