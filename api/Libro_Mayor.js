const axios = require("axios");

module.exports = async (req, res) => {
  try {

    const response = await axios.get(
      "https://script.google.com/macros/s/AKfycbzg6c30AGMzvL1Pvhc9WxQFqv1QHmM7mZtzKTUBRttlIT01Lqzkf3wTKK884-kDIFPS/exec",
      {
        timeout: 30000,
        headers: {
          Accept: "application/json"
        }
      }
    );

    const data =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;

    res.setHeader(
      "Content-Type",
      "application/json"
    );

    return res.status(200).json(data);

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      success: false,
      error: err.message
    });

  }
};