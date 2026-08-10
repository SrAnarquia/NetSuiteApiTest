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

    // ⚠️ AJUSTA "script" al ID real del RESTlet que expone customsearch8850
    // (el que devuelve el campo "Departamento"). El "5328" del ejemplo
    // anterior corresponde a customsearch3005, que NO trae Departamento.
    const params = {
      script: "XXXX", // <-- reemplaza por el script ID real de customsearch8850
      deploy: "1",
    };

    const request_data = {
      url: baseUrl,
      method: "GET",
      data: params,
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
      `oauth_signature="${encodeURIComponent(oauthData.oauth_signature)}"`;

    const response = await axios.get(baseUrl, {
      params,
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      responseType: "text",
    });

    /*
      NetSuite devuelve el body como string (por el JSON.stringify del RESTlet),
      así que hay que parsearlo aquí.
    */
    const parsedData =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;

    if (parsedData.success === false) {
      return res.status(500).json({
        success: false,
        error: parsedData.error || "Error desconocido desde NetSuite",
      });
    }

    /*
      Estructura real que devuelve el RESTlet (customsearch8850):
      {
        success: true,
        count: N,
        data: [
          {
            "ID": "...",
            "ID interno": "...",
            "Nombre": "...",
            "Acceso de inicio de sesión": "true" | "false",
            "Departamento": "..."   // ya viene como texto legible (getText),
                                     // no como ID, gracias al fix en el RESTlet
          },
          ...
        ]
      }
    */
    const rawData = parsedData.data || [];

    /*
      TRANSFORMAR A UN FORMATO MÁS AMIGABLE (camelCase, boolean real)
    */
    const formattedUsers = rawData.map((item) => ({
      id: item["ID"],
      internalId: item["ID interno"],
      name: item["Nombre"],
      hasLoginAccess: item["Acceso de inicio de sesión"] === "true",
      departamento: item["Departamento"] || "",
    }));

    return res.status(200).json({
      success: true,
      count: formattedUsers.length,
      data: formattedUsers,
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
};