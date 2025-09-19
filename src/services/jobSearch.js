const axios = require("axios");

const jobSearch = async (query = "jobs in india", page = "1", num_pages = "5", country = "in") => {
  try {
    const options = {
      method: "GET",
      url: "https://jsearch.p.rapidapi.com/search",
      params: {
        query: query,
        page: page,
        num_pages: num_pages,
        country: country,
        date_posted: "week",
      },
      headers: {
        "x-rapidapi-key": "66e25a8299msha6ec4f62ef9b62cp101e55jsnee5d0c35ed86",
        "x-rapidapi-host": "jsearch.p.rapidapi.com",
      },
    };

    const response = await axios.request(options);
    return response.data;
  } catch (error) {
    console.error("Error fetching data:", error.message);
    throw error;
  }
};

module.exports = {
  jobSearch,
};
