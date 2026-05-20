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

    // VIENE NEGATIVO Y ASI SE NECESITA
    const balanceApertura =
      Number(balanceData?.[0]?.total || 0);

    /*
    ==========================================
    RESULTADO
    ==========================================
    */

    const resultado = [];

    let previsionAnterior = 0;

    for (let i = 0; i < entradaData.length; i++) {

      const entradaSemana = entradaData[i];
      const salidaSemana = salidaData[i];

      /*
      ==========================================
      SEMANA / FECHA
      ==========================================
      */

      const semanaDel =
        entradaSemana.period ||
        entradaSemana.weekStart ||
        salidaSemana.period ||
        salidaSemana.weekStart ||
        null;

      /*
      ==========================================
      ENTRADA
      ==========================================
      */

      const entrada =
        Number(
          entradaSemana.total_inflow ??
          entradaSemana.totalInflow ??
          0
        );

      /*
      ==========================================
      SALIDA
      ==========================================
      */

      const salida =
        Number(
          salidaSemana.total_outflow ??
          salidaSemana.totalOutflow ??
          0
        );

      /*
      ==========================================
      PREVISION
      ==========================================
      */

      let prevision = 0;

      // PRIMERA SEMANA
      if (i === 0) {

        prevision =
          entrada
          - salida
          + balanceApertura;

      } else {

        // SEMANAS SIGUIENTES
        prevision =
          entrada
          - salida
          + previsionAnterior;
      }

      /*
      ==========================================
      PUSH RESULTADO
      ==========================================
      */

      resultado.push({

        semanaDel,

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

      /*
      ==========================================
      GUARDAR PREVISION
      ==========================================
      */

      previsionAnterior = prevision;
    }

    /*
    ==========================================
    RESPUESTA FINAL LIMPIA
    ==========================================
    */

    return res.status(200).json(resultado);

  } catch (error) {

    return res.status(500).json({
      error: error.message
    });

  }
}