const delay = (ms) =>
  new Promise(resolve =>
    setTimeout(resolve, ms)
  );

/*
==========================================
CACHE
==========================================
*/

let cache = null;
let cacheTimestamp = 0;

const CACHE_DURATION =
  5 * 60 * 1000;

export default async function handler(req, res) {

  try {

    /*
    ==========================================
    CACHE
    ==========================================
    */

    const now = Date.now();

    if (
      cache &&
      (now - cacheTimestamp) < CACHE_DURATION
    ) {

      return res.status(200).json(cache);
    }

    /*
    ==========================================
    ENDPOINTS
    ==========================================
    */

    const BALANCE_URL =
      'https://netsuiteapitest.vercel.app/api/Balance_Apertura';

    const ENTRADA_URL =
      'https://netsuiteapitest.vercel.app/api/Entrada_PreV2';

    const SALIDA_URL =
      'https://netsuiteapitest.vercel.app/api/Salida_PreV2';

    /*
    ==========================================
    FETCH SECUENCIAL
    ==========================================
    */

    console.log('BALANCE');

    const balanceResponse =
      await fetch(BALANCE_URL);

    if (!balanceResponse.ok) {

      throw new Error(
        `Balance Error: ${balanceResponse.status}`
      );
    }

    await delay(5000);

    console.log('ENTRADA');

    const entradaResponse =
      await fetch(ENTRADA_URL);

    if (!entradaResponse.ok) {

      throw new Error(
        `Entrada Error: ${entradaResponse.status}`
      );
    }

    await delay(5000);

    console.log('SALIDA');

    const salidaResponse =
      await fetch(SALIDA_URL);

    if (!salidaResponse.ok) {

      throw new Error(
        `Salida Error: ${salidaResponse.status}`
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
    BALANCE
    ==========================================
    */

    const balanceApertura =
      Number(balanceData?.[0]?.total || 0);

    /*
    ==========================================
    FILA TOTAL ENTRADAS
    ==========================================
    */

    const entradaTotalRow =
      entradaData.find(
        row =>
          row.categoriaCuenta === 'Total'
      ) || {};

    /*
    ==========================================
    FILA TOTAL SALIDAS
    ==========================================
    */

    const salidaTotalRow =
      salidaData.find(
        row =>
          row.categoriaCuenta === 'Total'
      ) || {};

    /*
    ==========================================
    OBTENER SEMANAS
    ==========================================
    */

    const semanas =
      Object.keys(entradaTotalRow)
        .filter(
          key =>
            key !== 'categoriaCuenta'
        );

    /*
    ==========================================
    RESULTADO
    ==========================================
    */

    const resultado = [];

    let previsionAnterior = 0;

    semanas.forEach((semana, index) => {

      const entrada =
        Number(
          entradaTotalRow[semana] || 0
        );

      const salida =
        Number(
          salidaTotalRow[semana] || 0
        );

      let prevision = 0;

      /*
      ==========================================
      PREVISION
      ==========================================
      */

      if (index === 0) {

        prevision =

          entrada
          - salida
          + balanceApertura;

      } else {

        prevision =

          entrada
          - salida
          + previsionAnterior;
      }

      resultado.push({

        semanaDel: semana,

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

      previsionAnterior =
        prevision;
    });

    /*
    ==========================================
    CACHE
    ==========================================
    */

    cache = resultado;

    cacheTimestamp =
      Date.now();

    /*
    ==========================================
    RESPONSE
    ==========================================
    */

    return res
      .status(200)
      .json(resultado);

  } catch (error) {

    console.error(error);

    return res.status(500).json({

      success: false,

      error:
        error.message ||
        'Error interno'
    });
  }
}