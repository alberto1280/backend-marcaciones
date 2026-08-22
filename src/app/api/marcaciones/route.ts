import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verificarRostro } from '@/lib/biometria/FaceRecognitionProvider';

// Función para calcular la distancia en metros usando la Fórmula de Haversine
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Radio de la Tierra en metros
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distancia en metros
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agenteId, ubicacionId, tipo, latitud, longitud, foto_evidencia } = body;

    // Validación de campos obligatorios
    if (!agenteId || !ubicacionId || !latitud || !longitud || !foto_evidencia) {
      return NextResponse.json(
        { error: 'Faltan parámetros obligatorios en la petición (agenteId, ubicacionId, latitud, longitud, foto_evidencia).' },
        { status: 400 }
      );
    }

    const lat = parseFloat(latitud);
    const lon = parseFloat(longitud);

    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json(
        { error: 'Coordenadas GPS inválidas.' },
        { status: 400 }
      );
    }

    // Paso A: Validar si la Ubicación y Agente existen en Prisma
    const agente = await prisma.agente.findUnique({
      where: { id: agenteId },
    });

    const ubicacion = await prisma.ubicacion.findUnique({
      where: { id: ubicacionId },
    });

    if (!agente) {
      return NextResponse.json(
        { error: `El agente con ID ${agenteId} no existe.` },
        { status: 404 }
      );
    }

    if (!ubicacion) {
      return NextResponse.json(
        { error: `La ubicación con ID ${ubicacionId} no existe.` },
        { status: 404 }
      );
    }

    // 1. Validar Geocerca
    const distanciaCalculada = haversineDistance(
      lat,
      lon,
      ubicacion.latitud,
      ubicacion.longitud
    );

    if (distanciaCalculada > ubicacion.radioMetros) {
      console.warn(`[Geocerca] Agente ${agenteId} fuera de rango. Distancia: ${distanciaCalculada.toFixed(2)}m, Radio permitido: ${ubicacion.radioMetros}m`);
      return NextResponse.json(
        { 
          status: 'ALERTA_GEOCERCA', 
          message: 'Fuera del rango permitido' 
        },
        { status: 403 }
      );
    }

    // Paso B: Validar Biometría Facial con el Adaptador
    console.log(`[Biometría] Validando rostro para el agente ${agenteId}...`);
    const biometriaOk = await verificarRostro(foto_evidencia, agenteId);

    if (!biometriaOk) {
      console.warn(`[Biometría] Falló la verificación facial para el agente ${agenteId}.`);
      return NextResponse.json(
        { 
          status: 'ALERTA_IDENTIDAD', 
          message: 'Verificación facial fallida' 
        },
        { status: 403 }
      );
    }

    // Paso C: Registrar Marcación (tabla Asistencia) como APROBADA
    const urlFotoEvidencia = `uploads/${Date.now()}_evidencia.jpg`;

    const nuevaAsistencia = await prisma.asistencia.create({
      data: {
        agenteId: agente.id,
        ubicacionId: ubicacion.id,
        tipo: tipo === 'SALIDA' ? 'SALIDA' : 'ENTRADA',
        latitudMarcacion: lat,
        longitudMarcacion: lon,
        distanciaMetros: parseFloat(distanciaCalculada.toFixed(2)),
        urlFotoEvidencia,
        porcentajeBiometria: 100.0,
        estado: 'APROBADA',
        minutosTarde: 0,
        modoOffline: false,
      },
    });

    console.log(`[Marcación] Marcación exitosa registrada para el agente ${agenteId} en la ubicación ${ubicacionId}.`);

    return NextResponse.json({
      success: true,
      mensaje: 'Marcación de asistencia procesada y registrada exitosamente.',
      data: {
        id: nuevaAsistencia.id,
        estado: nuevaAsistencia.estado,
        distanciaMetros: nuevaAsistencia.distanciaMetros,
        porcentajeBiometria: nuevaAsistencia.porcentajeBiometria,
        tipo: nuevaAsistencia.tipo,
        fechaHoraMarcacion: nuevaAsistencia.fechaHoraMarcacion,
      },
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error procesando marcación:', error);
    return NextResponse.json(
      { error: `Error interno del servidor: ${error.message}` },
      { status: 500 }
    );
  }
}
