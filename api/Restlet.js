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

async function run() {

  const url =
    "https://5227067.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=5127&deploy=1";

  const payload = {
    requestType: "ARAP_DRILLDOWN",

    pageSize: 1000,

    pageIndex: 0,

    type: "ap",

    filters: {
      startDate: null,

      endDate: "24/05/2026",

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
    OAUTH
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
      { headers }
    );

  console.log(
    JSON.stringify(
      response.data,
      null,
      2
    )
  );
}

run().catch(console.error);