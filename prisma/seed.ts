import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no está definida en el .env');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando el proceso de sembrado de datos (seed)...');

  // 1. Crear Empresa
  const empresa = await prisma.empresa.upsert({
    where: { ruc: '2026-SEGCENT-99' },
    update: {},
    create: {
      nombre: 'Seguridad Central',
      ruc: '2026-SEGCENT-99',
      activa: true,
    },
  });
  console.log(`Empresa creada/obtenida: ${empresa.nombre} (ID: ${empresa.id})`);

  // 2. Crear Ubicación
  const ubicacion = await prisma.ubicacion.create({
    data: {
      empresaId: empresa.id,
      nombre: 'PH Torre Ejecutiva',
      latitud: 8.9833,
      longitud: -79.5167,
      radioMetros: 100,
    },
  });
  console.log(`Ubicación creada: ${ubicacion.nombre} (ID: ${ubicacion.id})`);

  // 3. Crear Agente
  const agente = await prisma.agente.upsert({
    where: { cedula: '8-999-2026' },
    update: {},
    create: {
      empresaId: empresa.id,
      nombre: 'Ricardo Evers',
      cedula: '8-999-2026',
      activo: true,
    },
  });
  console.log(`Agente creado/obtenido: ${agente.nombre} (ID: ${agente.id})`);

  console.log('Datos de prueba creados exitosamente');
}

main()
  .catch((e) => {
    console.error('Error durante el sembrado de datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
