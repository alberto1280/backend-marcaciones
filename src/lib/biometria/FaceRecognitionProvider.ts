// MOCK para Vercel: Evita el error de TextEncoder durante el build
// y simula la biometría para poder probar la base de datos Neon hoy.

let isBiometryInitialized = false;

async function initBiometria() {
  console.log("Inicializando modelos biométricos de forma perezosa...");
}

export async function verificarRostro(fotoBase64: string, agenteId: string): Promise<boolean> {
  if (!isBiometryInitialized) {
    await initBiometria();
    isBiometryInitialized = true;
  }
  
  // Simula el tiempo de procesamiento de la IA (1.5 segundos)
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Siempre retorna true (aprobado) para probar la conexión con Neon DB
  return true;
}