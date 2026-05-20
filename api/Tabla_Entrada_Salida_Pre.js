const delay = (ms) =>
  new Promise(resolve =>
    setTimeout(resolve, ms)
  );

/*
==========================================
CACHE GLOBAL
==========================================
*/

let cache = null;
let cacheTimestamp = 0;

// 5 minutos
const CACHE_DURATION = 5 * 60 * 1000;

export default async function handler(req, res) {

  try {

    /*
    ==========================================
    VALIDAR CACHE
    ==========================================
    */

    const now = Date.now();

    if (
      cache &&
      (now - cacheTimestamp) < CACHE_DURATION
    ) {

      console.log('RESPONDIENDO DESDE CACHE');

      return res.status(200).json(cache);
    }

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
    FETCH SECUENCIAL
    ==========================================
    */

    console.log('CONSULTANDO BALANCE');

    const balanceResponse =
      await fetch(BALANCE_URL);

    if (!balanceResponse.ok) {

      throw new Error(
        `Error Balance: ${balanceResponse.status}`
      );
    }

    await delay(10000);

    console.log('CONSULTANDO ENTRADAS');

    const entradaResponse =
      await fetch(ENTRADA_URL);

    if (!entradaResponse.ok) {

      throw new Error(
        `Error Entrada: ${entradaResponse.status}`
      );
    }

    await delay(10000);

    console.log('CONSULTANDO SALIDAS');

    const salidaResponse =
      await fetch(SALIDA_URL);

    if (!salidaResponse.ok) {

      throw new Error(
        `Error Salida: ${salidaResponse.status}`
      );
    }

    /*
    ==========================================
    JSON
    ==========================================
    */

    const balanceData =
      await balanceResponse.json();

    const entradaData =
      await entradaResponse.json();

    const salidaData =
      await salidaResponse.json();

    /*
    ==========================================
    BALANCE APERTURA
    ==========================================
    */

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

      const entradaSemana =
        entradaData[i] || {};

      const salidaSemana =
        salidaData[i] || {};

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

      const entrada = Number(

        entradaSemana.total_inflow ??

        entradaSemana.totalInflow ??

        0
      );

      /*
      ==========================================
      SALIDA
      ==========================================
      */

      const salida = Number(

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
    GUARDAR CACHE
    ==========================================
    */

    cache = resultado;
    cacheTimestamp = Date.now();

    /*
    ==========================================
    RESPUESTA FINAL
    ==========================================
    */

    return res.status(200).json(resultado);

  } catch (error) {

    console.error(error);

    return res.status(500).json({

      success: false,

      error: error.message || 'Error interno'

    });
  }
}