// src/controllers/ubibot-controller.js

const axios = require("axios");
const fs = require("fs").promises;
const config = require("../config/config-loader");

class UbibotController {
  /**
   * Initializes a new instance of the UbibotController class.
   * Retrieves and sets the account key and token file path from the configuration.
   */

  constructor() {
    const { ubibot: ubibotConfig } = config.getConfig();
    this.accountKey = ubibotConfig.accountKey;
    this.tokenFile = ubibotConfig.tokenFile;
  }

  /**
   * Requests a new access token from the Ubibot API using the configured account key.
   * Writes the token to the specified token file if successful.
   * 
   * @returns {Promise<string|null>} The token ID if successful, or null if an error occurs.
   * 
   * @throws {Error} If the token generation fails due to an invalid account key.
   */

  async getNewToken() {
    try {
      const response = await axios.get(
        "https://webapi.ubibot.com/accounts/generate_access_token",
        {
          params: { account_key: this.accountKey },
        }
      );

      if (response.data.result === "success") {
        const tokenId = response.data.token_id;
        await fs.writeFile(this.tokenFile, tokenId);
        console.log("Ubibot: Token generado y guardado con éxito.");
        return tokenId;
      } else {
        throw new Error(
          "Ubibot: Error al generar el token, verifique su account_key."
        );
      }
    } catch (error) {
      console.error("Ubibot: Error al obtener el token:", error.message);
      return null;
    }
  }

  /**
   * Reads the access token from the specified token file.
   * 
   * @returns {Promise<string|null>} The token as a string if read successfully, or null if an error occurs.
   * 
   * @throws {Error} Logs an error message if the token file cannot be read.
   */

  async readToken() {
    try {
      return await fs.readFile(this.tokenFile, "utf8");
    } catch (error) {
      console.error("Ubibot: Error al leer el token:", error.message);
      return null;
    }
  }

  /**
   * Validates the given token ID by making a request to the Ubibot API.
   * 
   * @param {string} tokenId - The token ID to be validated.
   * @returns {Promise<boolean>} True if the token is valid, false otherwise.
   * 
   * @throws {Error} Logs an error message if the token validation fails due to a network or API error.
   */

  async isTokenValid(tokenId) {
    try {
      const response = await axios.get(`https://webapi.ubibot.com/channels`, {
        params: { token_id: tokenId },
      });
      return response.data.result === "success";
    } catch (error) {
      console.error("Ubibot: Error al validar el token:", error.message);
      return false;
    }
  }

  /**
   * Retrieves the list of Ubibot channels, excluding any channels specified in
   * the configuration file.
   * 
   * @returns {Promise<Array<Object>>} An array of channel objects if the request
   * is successful, or an empty array if not.
   * 
   * @throws {Error} Logs an error message if the request fails due to a network or
   * API error.
   */
  async getChannels() {
    let tokenId = await this.readToken();

    if (!tokenId || !(await this.isTokenValid(tokenId))) {
      tokenId = await this.getNewToken();
    }

    if (tokenId) {
      try {
        const response = await axios.get("https://webapi.ubibot.com/channels", {
          params: { token_id: tokenId },
        });

        if (response.data.result === "success") {
          const excludedChannels =
            config.getConfig().ubibot.excludedChannels || [];
          return response.data.channels.filter(
            (channel) => !excludedChannels.includes(channel.channel_id)
          );
        } else {
          throw new Error("Ubibot: Error al obtener los canales.");
        }
      } catch (error) {
        console.error("Ubibot: Error al obtener los canales:", error.message);
        return [];
      }
    }
  }

  /**
   * Retrieves the data of a specific Ubibot channel, given its ID.
   * 
   * @param {number} channelId - The ID of the channel to retrieve.
   * @returns {Promise<Object>} The channel data object if the request is
   * successful, or null if not.
   * 
   * @throws {Error} Logs an error message if the request fails due to a network
   * or API error.
   */
  async getChannelData(channelId) {
    let tokenId = await this.readToken();

    if (!tokenId || !(await this.isTokenValid(tokenId))) {
      tokenId = await this.getNewToken();
    }

    if (tokenId) {
      try {
        const response = await axios.get(
          `https://webapi.ubibot.com/channels/${channelId}`,
          {
            params: { token_id: tokenId },
          }
        );
        if (response.data && response.data.result === "success") {
          return response.data.channel;
        } else {
          throw new Error(
            `Ubibot: Error al obtener datos del canal ${channelId}.`
          );
        }
      } catch (error) {
        console.error(
          `Ubibot: Error al obtener datos del canal ${channelId}:`,
          error.message
        );
        return null;
      }
    }
  }
}

module.exports = new UbibotController();
