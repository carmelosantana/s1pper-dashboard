# Dashboard Views

This document describes the different view modes available for the s1pper dashboard.

## Overview

The dashboard supports multiple view modes (themes) that can be accessed via the `/view/{theme}` route. Each view provides a different layout and presentation optimized for specific use cases.

## Available Views

### Default View
- **Route:** `/` (root)
- **Description:** The standard dashboard view with full cards layout
- **Features:**
  - Complete printer status information
  - Temperature charts and history
  - Camera feed with controls
  - File information and progress
  - Lifetime statistics
  - Guestbook (when database is available)
  - Console output

### Stream View
- **Route:** `/view/stream`
- **Description:** Optimized for streaming to TV, Twitch, or YouTube
- **Resolution:** Optimized for 1920x1080 displays
- **Features:**
  - Full-screen video feed background
  - Minimalist overlay design with gradients for readability
  - **Top Left:** Printer status badge and current time
  - **Bottom Left:** File name, progress bar, and time information
  - **Top Right:** Temperature stats (extruder and bed) with power indicators
  - Real-time updates every 3 seconds
  - Automatic fallback to offline state when printer disconnects

## View Selector (Developer Mode)

When running in development mode (`NODE_ENV=development`), a view selector dropdown appears in the header next to the settings controls.

### Accessing the View Selector
1. Ensure you're running in development mode
2. Look for the Monitor icon (📺) in the header
3. Click the dropdown to select between:
   - **Default** - Standard dashboard view
   - **Stream** - Streaming-optimized view

### Navigation
- Selecting a view automatically navigates to the appropriate route
- View changes are tracked via analytics (when enabled)
- No page refresh required

## Implementation Details

### Server-Side Rendering
All views use Next.js App Router with server-side rendering:
- Initial data is fetched on the server
- Client components handle real-time updates
- No sensitive information exposed to client

### Data Updates
- Status updates: Every 3 seconds
- Temperature history: Every 3 seconds
- Camera stream: Continuous when printing
- Background snapshots: Every 30 seconds when idle

### Privacy Considerations
Views respect the dashboard visibility settings:
- **Offline mode:** Shows offline message
- **Private mode:** Redacts filenames and disables video
- **Public mode:** Shows all information

## Adding New Views

To add a new view:

1. Create a new client component in `/app/view/[theme]/`
2. Export a default component that accepts `initialStatus` and other data props
3. Add the theme name to the view selector in `components/settings-control.tsx`
4. Update the `ViewPage` component to handle the new theme
5. Document the new view in this file

### Example Structure

```tsx
// app/view/[theme]/my-view-client.tsx
"use client"

import { useState, useEffect } from 'react'
import type { PrinterStatus } from '@/lib/types'

interface MyViewClientProps {
  initialStatus: PrinterStatus | null
}

export default function MyViewClient({ initialStatus }: MyViewClientProps) {
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(initialStatus)
  
  // Implement your view logic here
  
  return (
    <div>
      {/* Your view UI */}
    </div>
  )
}
```

## Future View Ideas

- **Desktop View:** Windows 95/98 style retro desktop interface
- **Minimal View:** Ultra-minimal single stat view
- **Grid View:** Multi-printer grid layout for managing multiple printers
- **Mobile View:** Touch-optimized mobile interface
- **Kiosk View:** Public display mode with QR codes for interaction

## Technical Notes

- Views are rendered as dynamic routes: `/view/[theme]/page.tsx`
- Invalid theme names return 404 via `notFound()`
- All views share the same API endpoints
- View state is not persisted (returns to default on page refresh)
- Views can be accessed directly via URL (no authentication required)
