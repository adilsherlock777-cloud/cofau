# Cofau Partner Dashboard

A React-based dashboard for managing food orders from the Cofau app.

## Features

- **PIN-based Login**: Secure access with a 4-digit PIN (currently hardcoded as "1234")
- **Order Management**: View and manage orders in three categories:
  - New Orders (pending)
  - In Progress (confirmed, preparing, ready)
  - Completed (completed, cancelled)
- **Status Updates**: Update order status with action buttons
- **Auto-refresh**: Dashboard refreshes every 15 seconds to show new orders
- **Support Section**: Placeholder for future customer support features

## Development

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Deploy to Backend
```bash
# Build the app
npm run build

# Copy to backend static directory
cp -r dist/* ../backend/static/partner-dashboard/
```

## API Integration

The dashboard connects to these endpoints:

- `POST /api/orders/partner/login` - Login with PIN
- `GET /api/orders/partner/all` - Get all orders grouped by status
- `PATCH /api/orders/partner/{order_id}/status?status={status}` - Update order status

All partner endpoints require the PIN to be sent in the `X-Partner-PIN` header.

## Access

Once deployed, the dashboard is available at:
- Local: `http://localhost:8000/orders`
- Production: `https://api.cofau.com/orders`

## Default PIN

The default PIN is hardcoded as `1234` in `/backend/routers/orders.py`

To change it, edit the `PARTNER_PIN` constant in `backend/routers/orders.py`.

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Axios for API calls
