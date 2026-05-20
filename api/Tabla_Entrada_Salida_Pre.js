const axios = require("axios");

/*
|--------------------------------------------------------------------------
| URLS
|--------------------------------------------------------------------------
*/

const BALANCE_URL =
  "https://netsuiteapitest.vercel.app/api/Balance_Apertura.js";

const INFLOW_URL =
  "https://netsuiteapitest.vercel.app/api/Entrada_PreV1.js";

const OUTFLOW_URL =
  "https://netsuiteapitest.vercel.app/api/Salida_PreV1.js";

/*
|--------------------------------------------------------------------------
| CACHE
|--------------------------------------------------------------------------
|
| EVITA GOLPEAR NETSUITE
| EN REFRESHES SEGUIDOS
|
*/

let CACHE = {
  data: null,
  timestamp: 0
};

const CACHE_DURATION =
  1000 * 60 * 5; // 5 MIN

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

const sleep = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

const randomDelay = () =>
  Math.floor(
    Math.random() * 3000
  ) + 2000;

/*
|--------------------------------------------------------------------------
| TO NUMBER
|--------------------------------------------------------------------------
*/

const toNumber = (value) => {

  const n = Number(value);

  return isNaN(n)
    ? 0
    : n;
};

/*
|--------------------------------------------------------------------------
| NORMALIZE ARRAY
|--------------------------------------------------------------------------
*/

const normalizeArray = (data) => {

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.periods)) {
    return data.periods;
  }

  return [];
};

/*
|--------------------------------------------------------------------------
| RETRY REQUEST
|--------------------------------------------------------------------------
|
| REINTENTA SI NETSUITE
| CORTA LA CONEXION
|
*/

const requestWithRetry = async (
  url,
  params,
  retries = 3
) => {

  for (let attempt = 1; attempt <= retries; attempt++) {

    try {

      return await axios.get(url, {
        params,
        timeout: 180000
      });

    } catch (err) {

      console.log(
        `RETRY ${attempt} => ${url}`
      );

      if (attempt === retries) {
        throw err;
      }

      /*
        ESPERA ANTES DE REINTENTAR
      */
      await sleep(
        randomDelay()
      );
    }
  }
};

/*
|--------------------------------------------------------------------------
| LOCK
|--------------------------------------------------------------------------
|
| EVITA MULTIPLES EJECUCIONES
| SIMULTANEAS
|
*/

let isRunning = false;

/*
|--------------------------------------------------------------------------
| ENDPOINT
|--------------------------------------------------------------------------
*/

module.exports = async (req, res) => {

  try {

    /*
    |--------------------------------------------------------------------------
    | CACHE
    |--------------------------------------------------------------------------
    */

    const now = Date.now();

    if (
      CACHE.data &&
      (now - CACHE.timestamp) < CACHE_DURATION
    ) {

      console.log(
        "RETURN CACHE"
      );

      return res
        .status(200)
        .json(CACHE.data);
    }

    /*
    |--------------------------------------------------------------------------
    | LOCK
    |--------------------------------------------------------------------------
    */

    if (isRunning) {

      return res.status(429).json({
        success: false,
        error:
          "Another refresh is running"
      });
    }

    isRunning = true;

    const subsidiary =
      req.query.subsidiary || 2;

    /*
    |--------------------------------------------------------------------------
    | 1. BALANCE
    |--------------------------------------------------------------------------
    */

    const balanceResponse =
      await requestWithRetry(
        BALANCE_URL,
        { subsidiary }
      );

    await sleep(
      randomDelay()
    );

    /*
    |--------------------------------------------------------------------------
    | 2. INFLOW
    |--------------------------------------------------------------------------
    */

    const inflowResponse =
      await requestWithRetry(
        INFLOW_URL,
        { subsidiary }
      );

    await sleep(
      randomDelay()
    );

    /*
    |--------------------------------------------------------------------------
    | 3. OUTFLOW
    |--------------------------------------------------------------------------
    */

    const outflowResponse =
      await requestWithRetry(
        OUTFLOW_URL,
        { subsidiary }
      );

    /*
    |--------------------------------------------------------------------------
    | NORMALIZE
    |--------------------------------------------------------------------------
    */

    const balanceData =
      normalizeArray(balanceResponse.data);

    const inflowData =
      normalizeArray(inflowResponse.data);

    const outflowData =
      normalizeArray(outflowResponse.data);

    /*
    |--------------------------------------------------------------------------
    | BALANCE
    |--------------------------------------------------------------------------
    */

    const openingBalance =
      toNumber(
        balanceData?.[0]?.total
      );

    /*
    |--------------------------------------------------------------------------
    | MAP OUTFLOW
    |--------------------------------------------------------------------------
    */

    const outflowMap = {};

    for (const row of outflowData) {

      outflowMap[
        row.weekStart
      ] = row;
    }

    /*
    |--------------------------------------------------------------------------
    | FORECAST
    |--------------------------------------------------------------------------
    */

    let previousForecast = 0;

    const finalResult = [];

    for (let i = 0; i < inflowData.length; i++) {

      const inflowRow =
        inflowData[i];

      const weekStart =
        inflowRow.weekStart;

      const inflow =
        toNumber(
          inflowRow.totalInflow
        );

      const outflow =
        toNumber(
          outflowMap[weekStart]
            ?.totalOutflow
        );

      let currentForecast = 0;

      /*
        PREV1
      */
      if (i === 0) {

        currentForecast =
          inflow
          - outflow
          + openingBalance;

      } else {

        /*
          PREVN
        */
        currentForecast =
          inflow
          - outflow
          + previousForecast;
      }

      previousForecast =
        currentForecast;

      finalResult.push({

        semanaDel:
          weekStart,

        entradaMXN:
          Number(
            inflow.toFixed(2)
          ),

        salidaMXN:
          Number(
            outflow.toFixed(2)
          ),

        previsionMXN:
          Number(
            currentForecast.toFixed(2)
          )
      });
    }

    /*
    |--------------------------------------------------------------------------
    | SAVE CACHE
    |--------------------------------------------------------------------------
    */

    CACHE = {
      data: finalResult,
      timestamp: Date.now()
    };

    isRunning = false;

    return res
      .status(200)
      .json(finalResult);

  } catch (err) {

    isRunning = false;

    console.error(err);

    return res.status(500).json({

      success: false,

      error:
        err.response?.data ||
        err.message
    });
  }
};