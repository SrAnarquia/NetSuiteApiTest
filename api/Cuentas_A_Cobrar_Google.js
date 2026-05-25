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
    ==========================================
    FULL URL
    ==========================================
    */

    const url =
      "https://5227067.restlets.api.netsuite.com/app/site/hosting/restlet.nl" +
      "?script=5135&deploy=1";

    /*
    ==========================================
    REQUEST DATA
    ==========================================
    */

    const request_data = {
      url,
      method: "GET",
    };

    /*
    ==========================================
    OAUTH
    ==========================================
    */

    const oauthData =
      oauth.authorize(request_data, token);

    const authHeader =
      oauth.toHeader(oauthData);

    /*
    ==========================================
    REQUEST
    ==========================================
    */

    const response = await axios.get(url, {

      headers: {

        ...authHeader,

        realm:
          process.env.ACCOUNT_ID,

        Accept:
          "application/json",

      },

      responseType: "json"

    });

    /*
    ==========================================
    RESPONSE
    ==========================================
    */

    return res.status(200).json({

      success: true,

      data:
        response.data

    });

  } catch (err) {

    return res.status(500).json({

      success: false,

      error:
        err.response?.data ||
        err.message,

      details:
        err.response?.statusText ||

        null

    });

  }

};