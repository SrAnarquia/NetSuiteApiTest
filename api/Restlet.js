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

module.exports = async (req, res) => {

  try {

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
        URL RESTLET
      */
      const url =
        "https://5227067.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=5127&deploy=1";

      /*
        OAUTH
        IMPORTANTE:
        NO incluir data: payload
      */
      const request_data = {
        url,
        method: "POST"
      };

      const oauthData =
        oauth.authorize(
          request_data,
          token
        );

      /*
        HEADERS
      */
      const headers = {

        ...oauth.toHeader(
          oauthData
        ),

        realm:
          process.env.ACCOUNT_ID,

        "Content-Type":
          "application/json",

        Accept:
          "application/json"
      };

      /*
        REQUEST
      */
      const response =
        await axios.post(
          url,
          payload,
          {
            headers
          }
        );

      /*
        DEBUG
      */
      console.log(
        "STATUS:",
        response.status
      );

      /*
        DETECTAR ROWS
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
        SI YA NO HAY MÁS
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

    /*
      FINAL
    */
    return res.status(200).json({

      success: true,

      totalRows:
        allRows.length,

      data:
        allRows
    });

  } catch (err) {

    console.error(
      err.response?.data ||
      err.message
    );

    return res.status(500).json({

      success: false,

      error:
        err.response?.data ||
        err.message
    });
  }
};