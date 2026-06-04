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
    const baseUrl =
      "https://5227067.restlets.api.netsuite.com/app/site/hosting/restlet.nl";

    const params = {
      script: "5156",
      deploy: "1",
    };

    const request_data = {
      url: baseUrl,
      method: "GET",
      data: params,
    };

    const oauthData = oauth.authorize(request_data, token);

    const authHeader = oauth.toHeader(oauthData);

    const response = await axios.get(baseUrl, {
      params,
      headers: {
        ...authHeader,
        Accept: "application/json",
      },
      responseType: "text",
    });

    const json =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;

    return res.status(200).json(json.data || []);
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
};