import type { Server } from "socket.io";

export function getIO(): Server {
  return (global as Record<string, unknown>).__io as Server;
}

export function setIO(io: Server): void {
  (global as Record<string, unknown>).__io = io;
}
