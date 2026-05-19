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
      RESTLET 5123
    */
    const baseUrl =
      "https://5227067.restlets.api.netsuite.com/app/site/hosting/restlet.nl";

    const subsidiary =
      req.query.subsidiary || 2;

    const request_data = {
      url: baseUrl,
      method: "GET",

      data: {
        script: "5123",
        deploy: "1",
        subsidiary
      },
    };

    const oauthData =
      oauth.authorize(request_data, token);

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

    const response = await axios.get(baseUrl, {

      params: {
        script: "5123",
        deploy: "1",
        subsidiary
      },

      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },

      responseType: "text"
    });

    const parsedData =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;

    /*
      PERFECTO PARA POWERQUERY
    */
    return res.status(200).json([
      parsedData.data
    ]);

  } catch (err) {

    return res.status(500).json({
      success: false,

      error:
        err.response?.data ||
        err.message,
    });
  }
};