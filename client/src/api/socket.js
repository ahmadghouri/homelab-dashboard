import { io } from 'socket.io-client';

// One shared connection for live dashboard updates. It uses the same session cookie as the API.
// Connected by useDashboardSocket while the user is inside the app, closed on logout.
export const dashboardSocket = io('/dashboard', {
  autoConnect: false,
  withCredentials: true,
});
