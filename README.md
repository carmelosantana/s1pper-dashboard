# <image src="public/apple-touch-icon-ready.png" width="33px">  s1pper Dashboard

A fun, real-time dashboard for monitoring your Klipper/Moonraker 3D printer. Features live camera streaming, print status monitoring, temperature tracking, and an optional visitor guestbook! Primarily focused on the Ender 3 S1 Pro, but should work with other Klipper setups.

> 🐳 **Get started quickly** with the [Docker Deployment](#docker-deployment-recommended) guide.

## Features

- **Real-time Print Monitoring**: Live status updates, progress tracking, and time estimates
- **Camera Feed**: Live streaming and snapshot capture with privacy controls
- **Temperature Monitoring**: Real-time temperature charts for extruder and bed
- **Lifetime Statistics**: Track total print time, filament usage, and completed prints
- **Multiple View Modes**: Default dashboard, horizontal stream, and vertical stream layouts
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

## Dashboard Views

The dashboard supports multiple view modes optimized for different use cases.

### Available Views

#### Default View
- **Route:** `/` (root)
- **Description:** Standard dashboard with full feature cards layout
- **Features:**
  - Complete printer status information
  - Temperature charts and history
  - Camera feed with controls
  - File information and progress
  - Lifetime statistics
  - Guestbook (when database is available)
  - Settings panel (development mode)

#### Horizontal Stream View
- **Route:** `/view/stream/horizontal`
- **Description:** Optimized for streaming to TV, Twitch, or YouTube
- **Resolution:** 1920x1080 (landscape)
- **Layout:**
  - Full-screen video feed background
  - Minimalist overlay design with gradients for readability
  - **Top Left:** Printer status badge and current time
  - **Bottom Left:** File name, progress bar, and time information
  - **Top Right:** Temperature stats (extruder and bed) with power indicators
- **Updates:** Real-time updates every 3 seconds

#### Vertical Stream View
- **Route:** `/view/stream/vertical`
- **Description:** Optimized for mobile streaming and portrait displays
- **Resolution:** 1080x1920 (portrait)
- **Layout:**
  - Full-screen portrait video feed
  - Rotating information cards (changes every 5 seconds)
  - Card rotation: Temperatures, Speed, Filament, and Layers
  - **Top:** Printer status and current time
  - **Middle:** Rotating info card with smooth transitions
  - **Bottom:** File name and progress information
- **Updates:** Real-time updates every 3 seconds

### View Selector (Development Mode)

When running in development mode (`NODE_ENV=development`), a view selector dropdown appears in the header:

1. Look for the Monitor icon (📺) in the header next to settings
2. Select between "Default", "Horizontal Stream", or "Vertical Stream"
3. View changes are tracked via analytics (when enabled)

**Direct Access:**
- Default: `http://localhost:3000/`
- Horizontal Stream: `http://localhost:3000/view/stream/horizontal`
- Vertical Stream: `http://localhost:3000/view/stream/vertical`

### Privacy & View Settings

All views respect dashboard visibility settings:
- **Offline mode:** Shows offline message
- **Private mode:** Redacts filenames and disables video
- **Public mode:** Shows all information

### Technical Implementation

- **Server-Side Rendering:** Initial data fetched on server via Next.js App Router
- **Client Updates:** Real-time updates via client components
- **Data Security:** No sensitive information exposed to client
- **Camera Updates:**
  - Continuous stream when printing
  - Background snapshots every 30 seconds when idle
- **Routing:** Dynamic routes via `/view/[theme]/page.tsx`
- **Error Handling:** Invalid themes return 404

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
