import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Mapa en memoria para el Rate Limiting (Edge Container Scope)
const ipRequestHistory = new Map<string, number[]>();

const LIMIT_WINDOW_MS = 60 * 1000; // Ventana de 1 minuto
const MAX_REQUESTS_PER_WINDOW = 5; // Límite estricto de 5 peticiones

export function middleware(request: NextRequest) {
  // Interceptar llamadas a la API de marcaciones
  if (request.nextUrl.pathname.startsWith('/api/marcaciones')) {
    // Obtener la IP del cliente utilizando x-forwarded-for de forma segura
    const ipRaw = request.headers.get('x-forwarded-for') || '127.0.0.1';
    // Tomar la primera IP de la lista en caso de proxy/CDN
    const ip = ipRaw.split(',')[0].trim();

    const now = Date.now();
    const timestamps = ipRequestHistory.get(ip) || [];

    // Limpiar marcas de tiempo anteriores que ya estén fuera de la ventana de 1 minuto
    const validTimestamps = timestamps.filter(timestamp => now - timestamp < LIMIT_WINDOW_MS);

    // Si excede el límite de peticiones por minuto, rechazar con HTTP 429
    if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      console.warn(`[Rate Limit] IP bloqueada temporalmente por DDoS Protection: ${ip}`);
      return new NextResponse(
        JSON.stringify({
          error: 'Demasiadas peticiones biométricas. Límite de 5 intentos por minuto excedido para mitigar ataques DDoS.'
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Agregar marca de tiempo de la petición actual
    validTimestamps.push(now);
    ipRequestHistory.set(ip, validTimestamps);
  }

  return NextResponse.next();
}

// Interceptar las rutas bajo /api/marcaciones
export const config = {
  matcher: '/api/marcaciones/:path*',
};
