const axios = require("axios");
const OAuth = require("oauth-1.0a");
const crypto = require("crypto");

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

const BASE_URL =
  "https://5227067.restlets.api.netsuite.com/app/site/hosting/restlet.nl";

const PARAMS = {
  script: "5127",
  deploy: "1",
};

async function getAllData() {

  let pageIndex = 0;

  let allRows = [];

  while (true) {

    console.log(
      `PAGE ${pageIndex}`
    );

    /*
      PAYLOAD
    */
    const payload = {
      requestType:
        "ARAP_DRILLDOWN",

      pageSize: 1000,

      pageIndex,

      type: "ap",

      filters: {
        startDate: null,

        endDate:
          "24/05/2026",

        subsidiary: {
          id: 2,

          isConsolidated: false,

          subsidiaryList:
            [1,6,7,4,5,2,3]
        }
      },

      precision: 2,

      date: null
    };

    /*
      URL FINAL
    */
    const finalUrl =
      `${BASE_URL}?script=${PARAMS.script}&deploy=${PARAMS.deploy}`;

    /*
      REQUEST OAUTH
    */
    const request_data = {
      url: finalUrl,

      method: "POST",

      data: payload
    };

    /*
      GENERAR SIGNATURE
    */
    const oauthData =
      oauth.authorize(
        request_data,
        token
      );

    /*
      HEADER
    */
    const authHeader =
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
      )}"`;

    /*
      REQUEST
    */
    const response =
      await axios.post(

        BASE_URL,

        payload,

        {
          params: PARAMS,

          headers: {
            Authorization:
              authHeader,

            "Content-Type":
              "application/json",

            Accept:
              "application/json"
          }
        }
      );

    /*
      DETECTAR ARRAY
    */
    const rows =
      response.data.data ||
      response.data.rows ||
      response.data.results ||
      response.data.items ||
      [];

    console.log(
      `ROWS ${rows.length}`
    );

    /*
      ACUMULAR
    */
    allRows.push(...rows);

    /*
      FIN
    */
    if (
      rows.length < 1000
    ) {

      break;
    }

    /*
      SIGUIENTE PÁGINA
    */
    pageIndex++;
  }

  console.log(
    `TOTAL ${allRows.length}`
  );

  return allRows;
}

/*
  EJECUTAR
*/
getAllData()
  .then(data => {

    console.log(
      "DONE"
    );

    console.log(
      data.length
    );
  })
  .catch(console.error);