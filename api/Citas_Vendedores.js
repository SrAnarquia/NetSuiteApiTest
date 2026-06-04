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
    return crypto.createHmac("sha256", key).update(base_string).digest("base64");
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

    // 🔥 FIRMA MANUAL CORRECTA (SIN encodeURIComponent)
    const authHeader =
      'OAuth ' +
      `realm="${process.env.ACCOUNT_ID}",` +
      `oauth_consumer_key="${oauthData.oauth_consumer_key}",` +
      `oauth_token="${oauthData.oauth_token}",` +
      `oauth_signature_method="${oauthData.oauth_signature_method}",` +
      `oauth_timestamp="${oauthData.oauth_timestamp}",` +
      `oauth_nonce="${oauthData.oauth_nonce}",` +
      `oauth_version="1.0",` +
      `oauth_signature="${oauthData.oauth_signature}"`;

    const response = await axios.get(baseUrl, {
      params,
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      responseType: "text",
    });

    let raw = response.data;

    let json;

    if (typeof raw === "string") {
      try {
        json = JSON.parse(raw);
      } catch (e) {
        throw new Error("NetSuite no devolvió JSON válido: " + raw);
      }
    } else {
      json = raw;
    }

    const data = json.data ?? json;

    return res.status(200).json(data);

  } catch (err) {

    return res.status(500).json({
      error: err.response?.data || err.message,
    });
  }
};