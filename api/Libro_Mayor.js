const axios = require("axios");

module.exports = async (req, res) => {
  try {

    const response = await axios.get(
      "https://script.google.com/macros/s/AKfycbzVQQNbR9ncKNStobX5QSw5NHyO12imT8jo_orF31jQBzq6Z3QICnu89ILGvPOWhg9o/exec",
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