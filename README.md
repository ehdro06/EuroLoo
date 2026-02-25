# EuroLoo wc 🇪🇺

A privacy-first, community-driven public toilet finder for Europe. Powered by open data and modern web technologies.

## Why?

> "I think free public toilets should get budget before missiles and tanks."

Access to sanitation is a fundamental human right. EuroLoo exists to make finding clean, accessible, and free public toilets easier for everyone, without compromising user privacy.

## Features

- **🗺️ Open Data**: Powered by OpenStreetMap (OSM) to provide the most comprehensive map of public amenities.
- **Ey Privacy First**: No invasive tracking. We respect your location data and privacy.
- **📱 PWA Ready**: Installable on your mobile device for a native app-like experience.
- **👥 Community Driven**: Users can add new toilets and review existing ones to keep data fresh.
- **🔒 Secure**: Authentication handled by Clerk, ensuring secure user management.

## Tech Stack

### Client (Frontend)
- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **State Management**: Redux Toolkit & RTK Query
- **Styling**: Tailwind CSS & shadcn/ui (Radix Primitives)
- **Maps**: Leaflet / React-Leaflet
- **Auth**: Clerk

### Server (Backend)
- **Framework**: [NestJS](https://nestjs.com/)
- **Database**: PostgreSQL (via Docker)
- **ORM**: Prisma
- **API**: RESTful API with RTK Query integration
- **Auth**: Clerk SDK

## Getting Started

### Prerequisites
- Node.js (v20+)
- pnpm
- Docker (for local database)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/euroloo.git
   cd euroloo
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env` in both `client` and `server` directories.
   - Configure your Clerk keys and Database URL.

4. Start the database:
   ```bash
   cd server
   docker-compose up -d
   ```

5. Run migrations:
   ```bash
   pnpm prisma migrate dev
   ```

6. Start the development servers:
   
   **Server:**
   ```bash
   cd server
   pnpm dev
   ```

   **Client:**
   ```bash
   cd client
   pnpm dev
   ```

## Contributing
We welcome contributions! Please open an issue or submit a pull request.

## License
MIT
