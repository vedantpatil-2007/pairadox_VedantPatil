import http from 'node:http';

export function parseEnvContent(content: string): Record<string, string>;
export function loadLocalEnv(baseDir?: string): void;

declare const server: http.Server;
export default server;
