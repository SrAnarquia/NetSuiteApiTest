export default async function handler(req, res) {
  try {

    /*
    ==========================================
    ENDPOINTS
    ==========================================
    */

    const BALANCE_URL =
      'https://netsuiteapitest.vercel.app/api/Balance_Apertura.js';

    const ENTRADA_URL =
      'https://netsuiteapitest.vercel.app/api/Entrada_Pre.js';

    const SALIDA_URL =
      'https://netsuiteapitest.vercel.app/api/Salida_Pre.js';

    /*
    ==========================================
    FETCH
    ==========================================
    */

    const [
      balanceResponse,
      entradaResponse,
      salidaResponse
    ] = await Promise.all([
      fetch(BALANCE_URL),
      fetch(ENTRADA_URL),
      fetch(SALIDA_URL)
    ]);

    const balanceData = await balanceResponse.json();
    const entradaData = await entradaResponse.json();
    const salidaData = await salidaResponse.json();

    /*
    ==========================================
    BALANCE APERTURA
    ==========================================
    */

    // viene negativo en tu endpoint
    // lo convertimos positivo
    const balanceApertura =
      Math.abs(Number(balanceData?.[0]?.total || 0));

    /*
    ==========================================
    ARMAR TABLA
    ==========================================
    */

    const resultado = [];

    let previsionAnterior = balanceApertura;

    for (let i = 0; i < entradaData.length; i++) {

      const entradaSemana = entradaData[i];
      const salidaSemana = salidaData[i];

      const entrada =
        Number(entradaSemana.totalInflow || 0);

      const salida =
        Number(salidaSemana.totalOutflow || 0);

      /*
      ==========================================
      PREVISION
      ==========================================

      Semana 1:
      (Entrada - Salida) + Balance Apertura

      Semana 2:
      (Entrada - Salida) + Prev1

      etc...
      ==========================================
      */

      const prevision =
        (entrada - salida) + previsionAnterior;

      resultado.push({
        semanaDel: entradaSemana.period,

        entradaMXN: Number(
          entrada.toFixed(2)
        ),

        salidaMXN: Number(
          salida.toFixed(2)
        ),

        previsionMXN: Number(
          prevision.toFixed(2)
        )
      });

      previsionAnterior = prevision;
    }

    /*
    ==========================================
    RESPUESTA LIMPIA
    ==========================================
    */

    res.status(200).json(resultado);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }
}