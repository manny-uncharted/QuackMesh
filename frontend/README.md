# QuackMesh Frontend

A modern, interactive web application for the QuackMesh decentralized federated learning platform.

## Features

- **Modern Design**: Clean, tech-forward interface with smooth animations
- **Wallet Integration**: Connect with MetaMask and other Web3 wallets
- **Live Dashboard**: Real-time monitoring of compute nodes and earnings
- **Interactive Animations**: Canvas-based network visualization
- **Responsive Design**: Works seamlessly on desktop and mobile
- **TypeScript**: Full type safety throughout the application

## Tech Stack

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Wagmi/Viem** for Web3 integration
- **Zustand** for state management
- **Lucide React** for icons

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   
   Update the environment variables with your configuration.

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
frontend/
├── app/                    # Next.js app directory
│   ├── dashboard/         # Dashboard page
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   ├── page.tsx          # Landing page
│   └── providers.tsx     # App providers
├── components/            # Reusable components
│   ├── ui/               # UI components
│   ├── network-animation.tsx
│   ├── wallet-connect.tsx
│   └── live-stats.tsx
├── lib/                  # Utilities and configuration
│   ├── store.ts          # Zustand store
│   ├── utils.ts          # Utility functions
│   └── wagmi.ts          # Wagmi configuration
└── public/               # Static assets
```

## Key Components

### Landing Page (`/`)
- Hero section with animated network visualization
- "How It Works" section with interactive steps
- Live network statistics
- Wallet connection integration

### Dashboard (`/dashboard`)
- Earnings summary with claim rewards functionality
- Compute nodes monitoring with real-time stats
- Activity feed showing recent events
- Training jobs marketplace

### Network Animation
- Canvas-based visualization showing data flow
- Animated particles representing training updates and rewards
- Smooth, looping animation with device icons

## State Management

The app uses Zustand for state management with the following stores:

- **Network Stats**: Live statistics for the entire network
- **User Stats**: Personal earnings and node information
- **Activity Feed**: Recent user activities and events
- **Training Jobs**: Available jobs in the marketplace

## Wallet Integration

Built with Wagmi v2 and supports:
- MetaMask
- WalletConnect
- Other injected wallets
- DuckChain testnet configuration

## Styling

- **Tailwind CSS** for utility-first styling
- **Custom color palette**: Navy blue, orange, and cyan accents
- **Responsive design** with mobile-first approach
- **Smooth animations** using Framer Motion
- **Custom components** with consistent design system

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Environment Variables

- `NEXT_PUBLIC_WC_PROJECT_ID` - WalletConnect project ID
- `NEXT_PUBLIC_API_BASE_URL` - QuackMesh API base URL
- `NEXT_PUBLIC_RPC_URL` - DuckChain RPC endpoint
- Contract addresses for Web3 integration

## Deployment

The frontend can be deployed to any platform that supports Next.js:

- **Vercel** (recommended)
- **Netlify**
- **AWS Amplify**
- **Docker** with the included configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is part of the QuackMesh platform and follows the same licensing terms.