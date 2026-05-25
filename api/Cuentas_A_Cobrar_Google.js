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
    RESTLET URL
    ==========================================
    */

    const baseUrl =
      "https://5227067.restlets.api.netsuite.com/app/site/hosting/restlet.nl";

    const params = {
      script: "5135",
      deploy: "1",
    };

    /*
    ==========================================
    OAUTH
    ==========================================
    */

    const request_data = {
      url: baseUrl,
      method: "GET",
      data: params,
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
      )}`;

    /*
    ==========================================
    REQUEST
    ==========================================
    */

    const response = await axios.get(baseUrl, {

      params,

      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },

      responseType: "text"

    });

    /*
    ==========================================
    PARSE JSON
    ==========================================
    */

    const parsedData =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;

    /*
    ==========================================
    VALIDAR RESPONSE
    ==========================================
    */

    if (!parsedData.success) {

      return res.status(500).json({
        success: false,
        error:
          parsedData.error ||
          "NETSUITE_RESTLET_ERROR",
      });

    }

    /*
    ==========================================
    EXTRAER DATA
    ==========================================
    */

    const data =
      parsedData.data || [];

    /*
    ==========================================
    TRANSFORMAR RESULTADOS
    ==========================================
    */

    const result = data.map(row => ({

      periodName:
        row.period_name,

      weekStart:
        row.week_start,

      id:
        Number(row.id),

      tranid:
        row.tranid,

      transactionNumber:
        row.transactionnumber,

      transactionType:
        row.transaction_type,

      transactionDate:
        row.trandate,

      dueDate:
        row.duedate,

      closeDate:
        row.closedate,

      entity:
        row.entity,

      subsidiary:
        row.subsidiary,

      accountNumber:
        row.acctnumber,

      accountName:
        row.account_name,

      accountType:
        row.accttype,

      debit:
        Number(row.debit || 0),

      credit:
        Number(row.credit || 0),

      amountLinked:
        Number(row.amountlinked || 0),

      grossComponent:
        Number(row.gross_component || 0),

      finalComponent:
        Number(row.final_component || 0),

    }));

    /*
    ==========================================
    TOTAL RECONSTRUIDO
    ==========================================
    */

    const reconstructedTotal =
      result.reduce((acc, row) => {

        return acc + row.finalComponent;

      }, 0);

    /*
    ==========================================
    RESPONSE
    ==========================================
    */

    return res.status(200).json({

      success: true,

      count:
        result.length,

      reconstructedTotal:
        Number(
          reconstructedTotal.toFixed(2)
        ),

      data:
        result,

    });

  } catch (err) {

    return res.status(500).json({

      success: false,

      error:
        err.response?.data ||
        err.message,

    });

  }

};