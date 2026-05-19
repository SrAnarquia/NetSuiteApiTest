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

async function getCashflowData() {

  try {

    /*
      RESTLET URL
    */
    const baseUrl =
      "https://5227067.restlets.api.netsuite.com/app/site/hosting/restlet.nl";

    /*
      PARAMETROS DEL RESTLET
    */
    const params = {
      script: "5122",
      deploy: "1",
    };

    /*
      IMPORTANTE:
      request_data.data
      y axios params
      deben coincidir EXACTAMENTE
    */
    const request_data = {
      url: baseUrl,
      method: "GET",

      data: params,
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
    const response = await axios.get(baseUrl, {

      params,

      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },

      /*
        NetSuite normalmente responde STRING
      */
      responseType: "text"
    });

    /*
      PARSEAR RESPUESTA
    */
    const parsedData =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;

    /*
      MOSTRAR SOLO DATA
    */
    console.log(parsedData.data);

    /*
      RETORNAR SOLO DATA
    */
    return parsedData.data;

  } catch (err) {

    console.error({
      success: false,

      error:
        err.response?.data ||
        err.message,
    });
  }
}

/*
  EJECUTAR
*/
getCashflowData();