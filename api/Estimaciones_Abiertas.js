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
      script: "5158",
      deploy: "1",
    };

    // URL completa para que la firma incluya query params
    const fullUrl =
      `${baseUrl}?script=${params.script}&deploy=${params.deploy}`;

    const request_data = {
      url: fullUrl,
      method: "GET",
    };

    const oauthData = oauth.authorize(request_data, token);

    const authHeader =
      "OAuth " +
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

    const response = await axios.get(fullUrl, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      responseType: "text",
      timeout: 120000,
    });

    let result = response.data;

    // Si NetSuite devolvió texto JSON
    if (typeof result === "string") {
      try {
        result = JSON.parse(result);
      } catch (e) {
        return res.status(500).json({
          success: false,
          error: "NetSuite devolvió texto no válido como JSON",
          raw: result,
        });
      }
    }

    // Si data viene stringify dentro del objeto
    if (
      result &&
      typeof result.data === "string"
    ) {
      try {
        result.data = JSON.parse(result.data);
      } catch (e) {
        // lo dejamos igual si no es JSON válido
      }
    }

    return res.status(200).json(result);

  } catch (err) {
    return res.status(
      err.response?.status || 500
    ).json({
      success: false,
      error:
        err.response?.data ||
        err.message ||
        "Error desconocido",
    });
  }
};