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
| HELPERS
|--------------------------------------------------------------------------
*/

const sleep = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

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

  /*
    DIRECT ARRAY
  */
  if (Array.isArray(data)) {
    return data;
  }

  /*
    ARRAY INSIDE data
  */
  if (Array.isArray(data?.data)) {
    return data.data;
  }

  /*
    ARRAY INSIDE periods
  */
  if (Array.isArray(data?.periods)) {
    return data.periods;
  }

  return [];
};

/*
|--------------------------------------------------------------------------
| ENDPOINT
|--------------------------------------------------------------------------
*/

module.exports = async (req, res) => {

  try {

    const subsidiary =
      req.query.subsidiary || 2;

    /*
    |--------------------------------------------------------------------------
    | 1. BALANCE
    |--------------------------------------------------------------------------
    */

    const balanceResponse =
      await axios.get(BALANCE_URL, {
        params: { subsidiary },
        timeout: 180000
      });

    await sleep(2000);

    /*
    |--------------------------------------------------------------------------
    | 2. INFLOW
    |--------------------------------------------------------------------------
    */

    const inflowResponse =
      await axios.get(INFLOW_URL, {
        params: { subsidiary },
        timeout: 180000
      });

    await sleep(2000);

    /*
    |--------------------------------------------------------------------------
    | 3. OUTFLOW
    |--------------------------------------------------------------------------
    */

    const outflowResponse =
      await axios.get(OUTFLOW_URL, {
        params: { subsidiary },
        timeout: 180000
      });

    /*
    |--------------------------------------------------------------------------
    | NORMALIZE DATA
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
    | DEBUG
    |--------------------------------------------------------------------------
    */

    console.log("BALANCE:", balanceData);
    console.log("INFLOW:", inflowData);
    console.log("OUTFLOW:", outflowData);

    /*
    |--------------------------------------------------------------------------
    | OPENING BALANCE
    |--------------------------------------------------------------------------
    */

    const openingBalance =
      toNumber(balanceData?.[0]?.total);

    /*
    |--------------------------------------------------------------------------
    | MAP OUTFLOW
    |--------------------------------------------------------------------------
    */

    const outflowMap = {};

    for (const row of outflowData) {

      outflowMap[row.weekStart] = row;
    }

    /*
    |--------------------------------------------------------------------------
    | FINAL RESULT
    |--------------------------------------------------------------------------
    |
    | Prev1 =
    | Inflow1 - Outflow1 + OpeningBalance
    |
    | Prev2 =
    | Inflow2 - Outflow2 + Prev1
    |
    | Prev3 =
    | Inflow3 - Outflow3 + Prev2
    |
    */

    let previousForecast = 0;

    const finalResult = [];

    for (let i = 0; i < inflowData.length; i++) {

      const inflowRow =
        inflowData[i];

      const weekStart =
        inflowRow.weekStart;

      const inflow =
        toNumber(inflowRow.totalInflow);

      const outflow =
        toNumber(
          outflowMap[weekStart]?.totalOutflow
        );

      /*
      |--------------------------------------------------------------------------
      | CURRENT FORECAST
      |--------------------------------------------------------------------------
      */

      let currentForecast = 0;

      /*
        PREV1 =
        ENTRADA1 - SALIDA1 + BALANCE
      */
      if (i === 0) {

        currentForecast =
          inflow
          - outflow
          + openingBalance;

      } else {

        /*
          PREVN =
          ENTRADAN - SALIDAN + PREVIO
        */

        currentForecast =
          inflow
          - outflow
          + previousForecast;
      }

      /*
      |--------------------------------------------------------------------------
      | SAVE PREVIOUS
      |--------------------------------------------------------------------------
      */

      previousForecast =
        currentForecast;

      /*
      |--------------------------------------------------------------------------
      | PUSH RESULT
      |--------------------------------------------------------------------------
      */

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
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    return res.status(200).json(
      finalResult
    );

  } catch (err) {

    console.error(err);

    return res.status(500).json({

      success: false,

      error:
        err.response?.data ||
        err.message
    });
  }
};