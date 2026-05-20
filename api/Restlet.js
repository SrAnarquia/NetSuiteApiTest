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

    /*
      PAYLOAD QUE OCUPA EL SUITELET
    */
    const payload = {
      requestType: "ARAP_DRILLDOWN",
      pageSize: 25,
      pageIndex: 0,
      type: "ap",

      filters: {
        startDate: null,

        endDate: "24/05/2026",

        subsidiary: {
          id: 2,
          isConsolidated: false,
          subsidiaryList: [1, 6, 7, 4, 5, 2, 3]
        }
      },

      precision: 2,
      date: null
    };

    /*
      URL RESTLET
    */
    const baseUrl =
      "https://5227067.restlets.api.netsuite.com/app/site/hosting/restlet.nl";

    /*
      PARAMS
    */
    const params = {
      script: "5127",
      deploy: "1",
    };

    /*
      REQUEST DATA OAUTH
    */
    const request_data = {
      url: `${baseUrl}?script=5127&deploy=1`,
      method: "POST",
      data: payload,
    };

    /*
      GENERAR OAUTH
    */
    const oauthData =
      oauth.authorize(request_data, token);

    /*
      HEADER AUTH
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
      LLAMAR RESTLET
    */
    const response = await axios.post(

      baseUrl,

      payload,

      {
        params,

        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },

        responseType: "text",
      }
    );

    /*
      PARSEAR
    */
    const parsedData =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;

    /*
      RETORNAR
    */
    return res.status(200).json(parsedData);

  } catch (err) {

    console.error(err.response?.data || err);

    return res.status(500).json({
      success: false,

      error:
        err.response?.data ||
        err.message,
    });
  }
};