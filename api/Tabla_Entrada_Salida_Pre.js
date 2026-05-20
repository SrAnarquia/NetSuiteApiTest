const axios = require("axios");

/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

const BALANCE_URL =
  "https://netsuiteapitest.vercel.app/api/Balance_Apertura.js";

const OUTFLOW_URL =
  "https://netsuiteapitest.vercel.app/api/Salida_PreV2.js";

const INFLOW_URL =
  "https://netsuiteapitest.vercel.app/api/Entrada_PreV2.js";

/*
|--------------------------------------------------------------------------
| DELAY CONTROL
|--------------------------------------------------------------------------
| IMPORTANTE:
| NetSuite se rompe si haces llamadas simultáneas.
| Por eso:
|   - llamadas secuenciales
|   - delay entre requests
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
| MAIN ENDPOINT
|--------------------------------------------------------------------------
*/

module.exports = async (req, res) => {

  try {

    const subsidiary =
      req.query.subsidiary || "2";

    /*
    |--------------------------------------------------------------------------
    | 1. BALANCE
    |--------------------------------------------------------------------------
    */

    const balanceResponse =
      await axios.get(BALANCE_URL, {
        params: { subsidiary },
        timeout: 120000
      });

    await sleep(1500);

    /*
    |--------------------------------------------------------------------------
    | 2. OUTFLOW
    |--------------------------------------------------------------------------
    */

    const outflowResponse =
      await axios.get(OUTFLOW_URL, {
        params: { subsidiary },
        timeout: 120000
      });

    await sleep(1500);

    /*
    |--------------------------------------------------------------------------
    | 3. INFLOW
    |--------------------------------------------------------------------------
    */

    const inflowResponse =
      await axios.get(INFLOW_URL, {
        params: { subsidiary },
        timeout: 120000
      });

    /*
    |--------------------------------------------------------------------------
    | DATA
    |--------------------------------------------------------------------------
    */

    const balanceData =
      balanceResponse.data || [];

    const outflowData =
      outflowResponse.data || [];

    const inflowData =
      inflowResponse.data || [];

    /*
    |--------------------------------------------------------------------------
    | BALANCE INICIAL
    |--------------------------------------------------------------------------
    */

    const initialBalance =
      toNumber(balanceData?.[0]?.total);

    /*
    |--------------------------------------------------------------------------
    | MAP OUTFLOWS
    |--------------------------------------------------------------------------
    */

    const outflowMap = {};

    outflowData.forEach(item => {

      outflowMap[item.weekStart] = {
        outflow: toNumber(item.totalOutflow)
      };
    });

    /*
    |--------------------------------------------------------------------------
    | MAP INFLOWS
    |--------------------------------------------------------------------------
    */

    const inflowMap = {};

    inflowData.forEach(item => {

      inflowMap[item.weekStart] = {
        inflow: toNumber(item.totalInflow)
      };
    });

    /*
    |--------------------------------------------------------------------------
    | GET ALL PERIODS
    |--------------------------------------------------------------------------
    */

    const allWeeks =
      [
        ...Object.keys(inflowMap),
        ...Object.keys(outflowMap)
      ];

    /*
    |--------------------------------------------------------------------------
    | REMOVE DUPLICATES
    |--------------------------------------------------------------------------
    */

    const uniqueWeeks =
      [...new Set(allWeeks)];

    /*
    |--------------------------------------------------------------------------
    | SORT DD/MM/YYYY
    |--------------------------------------------------------------------------
    */

    uniqueWeeks.sort((a, b) => {

      const [da, ma, ya] = a.split("/");
      const [db, mb, yb] = b.split("/");

      const dateA =
        new Date(`${ya}-${ma}-${da}`);

      const dateB =
        new Date(`${yb}-${mb}-${db}`);

      return dateA - dateB;
    });

    /*
    |--------------------------------------------------------------------------
    | BUILD FINAL RESPONSE
    |--------------------------------------------------------------------------
    */

    let previousForecast =
      initialBalance;

    const finalResult =
      uniqueWeeks.map((week, index) => {

        const inflow =
          toNumber(
            inflowMap?.[week]?.inflow
          );

        const outflow =
          toNumber(
            outflowMap?.[week]?.outflow
          );

        /*
        |--------------------------------------------------------------------------
        | FORECAST
        |--------------------------------------------------------------------------
        |
        | Prev1 = Entrada1 - Salida1 + (Balance)
        | Prev2 = Entrada2 - Salida2 + (Prev1)
        |--------------------------------------------------------------------------
        */

        const forecast =
          inflow
          - outflow
          + previousForecast;

        previousForecast =
          forecast;

        return {

          semanaDel: week,

          entradaMXN:
            Number(inflow.toFixed(2)),

          salidaMXN:
            Number(outflow.toFixed(2)),

          previsionMXN:
            Number(forecast.toFixed(2))
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