# OmegleSol - Video Chat with Solana Tipping

OmegleSol is a decentralized video chat platform that allows users to connect with random people and send tips using Solana cryptocurrency.

## Features

- Random video chat connections
- Solana wallet integration
- Send tips to chat partners with a single click
- Real-time video and audio communication using WebRTC
- Modern UI with Tailwind CSS

## Technology Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Blockchain**: Solana, Anchor Framework
- **Video Chat**: WebRTC
- **Wallet Integration**: Solana Wallet Adapter

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- Yarn or npm
- Solana CLI tools (for development)
- A Solana wallet (Phantom, Solflare, etc.)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/omeglesol.git
   cd omeglesol
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the development server:
   ```
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Solana Program

The tipping functionality is powered by a custom Solana program built with Anchor. The program handles the transfer of SOL from one user to another.

### Program Structure

- `solana-tip/programs/solana-tip/src/lib.rs`: Contains the Solana program logic
- `src/lib/tipProgramClient.ts`: Client-side integration with the Solana program

## Deployment

The application is currently deployed on Solana devnet. To use the application:

1. Connect your Solana wallet
2. Ensure you have some devnet SOL (you can get some from a faucet)
3. Start a video chat
4. Send tips to your chat partner

## License

[MIT](LICENSE)

## Acknowledgements

- Solana Foundation
- Anchor Framework
- Next.js Team
