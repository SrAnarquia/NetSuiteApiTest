const axios = require("axios");

/*
|--------------------------------------------------------------------------
| CONFIG
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
| DELAY CONTROL
|--------------------------------------------------------------------------
*/

const sleep = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

/*
|--------------------------------------------------------------------------
| SAFE NUMBER
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
    |
    | NO HACER TODO EN PARALELO
    | NETSUITE SE SATURA
    |
    */

    const balanceResponse =
      await axios.get(BALANCE_URL, {
        params: { subsidiary },
        timeout: 120000
      });

    await sleep(1500);

    /*
    |--------------------------------------------------------------------------
    | 2. INFLOW
    |--------------------------------------------------------------------------
    */

    const inflowResponse =
      await axios.get(INFLOW_URL, {
        params: { subsidiary },
        timeout: 120000
      });

    await sleep(1500);

    /*
    |--------------------------------------------------------------------------
    | 3. OUTFLOW
    |--------------------------------------------------------------------------
    */

    const outflowResponse =
      await axios.get(OUTFLOW_URL, {
        params: { subsidiary },
        timeout: 120000
      });

    /*
    |--------------------------------------------------------------------------
    | DATA EXTRACTION
    |--------------------------------------------------------------------------
    */

    const balanceData =
      balanceResponse.data || [];

    const inflowData =
      inflowResponse.data || [];

    const outflowData =
      outflowResponse.data || [];

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
    | BUILD FINAL RESULT
    |--------------------------------------------------------------------------
    */

    let runningForecast =
      openingBalance;

    const finalResult =
      inflowData.map((inflowRow) => {

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
        | FORECAST
        |--------------------------------------------------------------------------
        |
        | Prev = Entrada - Salida + Balance/Previo
        |
        */

        runningForecast =
          inflow
          - outflow
          + runningForecast;

        return {

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
              runningForecast.toFixed(2)
            )
        };
      });

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    return res.status(200).json(finalResult);

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