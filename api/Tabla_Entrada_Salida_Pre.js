const axios = require("axios");
const OAuth = require("oauth-1.0a");
const crypto = require("crypto");
const { Parser } = require("json2csv");
const fs = require("fs");

/*
|--------------------------------------------------------------------------
| OAUTH
|--------------------------------------------------------------------------
*/

const oauth = OAuth({
  consumer: {
    key: process.env.CONSUMER_KEY,
    secret: process.env.CONSUMER_SECRET,
  },

  signature_method: "HMAC-SHA256",

  hash_function(base_string, key) {
    return crypto
      .createHmac("sha256", key)
      .update(base_string)
      .digest("base64");
  },
});

const token = {
  key: process.env.TOKEN_ID,
  secret: process.env.TOKEN_SECRET,
};

/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

const RESTLET_URL =
  "https://5227067.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=5127&deploy=1";

const PAGE_SIZE = 1000;

/*
|--------------------------------------------------------------------------
| SLEEP
|--------------------------------------------------------------------------
*/

const sleep = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

/*
|--------------------------------------------------------------------------
| GET AUTH HEADER
|--------------------------------------------------------------------------
*/

const getAuthHeader = () => {

  const request_data = {
    url: RESTLET_URL,
    method: "GET"
  };

  const oauthData =
    oauth.authorize(
      request_data,
      token
    );

  return (
    'OAuth ' +
    `realm="${process.env.ACCOUNT_ID}",` +
    `oauth_consumer_key="${oauthData.oauth_consumer_key}",` +
    `oauth_token="${oauthData.oauth_token}",` +
    `oauth_signature_method="${oauthData.oauth_signature_method}",` +
    `oauth_timestamp="${oauthData.oauth_timestamp}",` +
    `oauth_nonce="${oauthData.oauth_nonce}",` +
    `oauth_version="1.0",` +
    `oauth_signature="${encodeURIComponent(
      oauthData.oauth_signature
    )}"`
  );
};

/*
|--------------------------------------------------------------------------
| MAIN
|--------------------------------------------------------------------------
*/

(async () => {

  try {

    let pageIndex = 0;

    let keepGoing = true;

    let allRows = [];

    while (keepGoing) {

      console.log(
        `PAGE => ${pageIndex}`
      );

      /*
      |--------------------------------------------------------------------------
      | PARAMS
      |--------------------------------------------------------------------------
      */

      const params = {

        requestType:
          "ARAP_DRILLDOWN",

        pageSize:
          PAGE_SIZE,

        pageIndex,

        type:
          "ap",

        filters: JSON.stringify({

          startDate:
            null,

          endDate:
            "24/05/2026",

          period:
            "18/05/2026",

          subsidiary: {

            id:
              2,

            isConsolidated:
              false,

            subsidiaryList:
              [1,6,7,4,5,2,3]
          }
        }),

        precision:
          2,

        forecastBy:
          2,

        periodDate:
          "18/05/2026",

        year:
          2026,

        date:
          ""
      };

      /*
      |--------------------------------------------------------------------------
      | REQUEST
      |--------------------------------------------------------------------------
      */

      const response =
        await axios.get(
          RESTLET_URL,
          {
            params,

            timeout:
              300000,

            headers: {
              Authorization:
                getAuthHeader()
            }
          }
        );

      /*
      |--------------------------------------------------------------------------
      | BODY
      |--------------------------------------------------------------------------
      */

      const result =
        response.data;

      console.log(
        "RAW RESPONSE:"
      );

      console.log(result);

      /*
      |--------------------------------------------------------------------------
      | AJUSTAR SEGUN RESPONSE REAL
      |--------------------------------------------------------------------------
      */

      let rows = [];

      /*
        SI EL RESTLET
        REGRESA:
        {
          body: "...."
        }
      */

      if (result?.body) {

        try {

          const parsed =
            JSON.parse(
              result.body
            );

          rows =
            parsed.data ||
            parsed.rows ||
            parsed.results ||
            [];

        } catch (e) {

          console.log(
            "NO JSON BODY"
          );

          rows = [];
        }

      } else {

        rows =
          result.data ||
          result.rows ||
          result.results ||
          [];
      }

      /*
      |--------------------------------------------------------------------------
      | LOG
      |--------------------------------------------------------------------------
      */

      console.log(
        `ROWS => ${rows.length}`
      );

      /*
      |--------------------------------------------------------------------------
      | FIN
      |--------------------------------------------------------------------------
      */

      if (!rows.length) {

        keepGoing = false;

        break;
      }

      /*
      |--------------------------------------------------------------------------
      | ACUMULAR
      |--------------------------------------------------------------------------
      */

      allRows.push(
        ...rows
      );

      /*
      |--------------------------------------------------------------------------
      | NEXT PAGE
      |--------------------------------------------------------------------------
      */

      pageIndex++;

      /*
      |--------------------------------------------------------------------------
      | DELAY
      |--------------------------------------------------------------------------
      */

      await sleep(1500);
    }

    /*
    |--------------------------------------------------------------------------
    | TOTAL
    |--------------------------------------------------------------------------
    */

    console.log(
      `TOTAL ROWS => ${allRows.length}`
    );

    /*
    |--------------------------------------------------------------------------
    | CSV
    |--------------------------------------------------------------------------
    */

    const parser =
      new Parser();

    const csv =
      parser.parse(
        allRows
      );

    /*
    |--------------------------------------------------------------------------
    | SAVE FILE
    |--------------------------------------------------------------------------
    */

    fs.writeFileSync(
      "cash360.csv",
      csv
    );

    console.log(
      "CSV GENERATED"
    );

  } catch (err) {

    console.error(
      err.response?.data ||
      err.message
    );
  }

})();