import { isArray } from "lodash";

const HOSTS = {
  Mainnet: "https://mainnet-public.mirrornode.hedera.com",
  Testnet: "https://testnet.mirrornode.hedera.com",
  Previewnet: "https://previewnet.mirrornode.hedera.com",
};

const KABUTOHOSTS = {
  Mainnet: "https://v2.api.kabuto.sh",
  Testnet: "https://v2.api.testnet.kabuto.sh",
};

const GET = (hosts, network, route, accumulator = {}) =>
  fetch(`${hosts[network]}${route}`).then(async (x) => {
    if (x.status === 200) {
      const response = await x.json();
      const merged = Object.keys(response).reduce((result, key) => {
        if (accumulator[key]) {
          if (isArray(response[key])) {
            return {
              [key]: [...accumulator[key], ...response[key]],
              ...result,
            };
          } else {
            return {
              [key]: { ...accumulator[key], ...response[key] },
              ...result,
            };
          }
        } else {
          return { [key]: response[key], ...result };
        }
      }, {});

      if (response?.links?.next) {
        return await GET(hosts, network, response?.links?.next, merged);
      } else {
        return merged;
      }
    } else if (!x.ok) {
      throw new Error(`${x.status}: ${x.statusText}`);
    } else {
      return { status: x.status };
    }
  });

export default class ApiService {
  static getAccountsFromPublicKey(network, publicKey) {
    const formatted = Buffer.from(publicKey.toBytes()).toString("hex");
    return GET(
      HOSTS,
      network,
      `/api/v1/accounts?account.publickey=${formatted}`
    )
      .then((x) => x.accounts.map((acc) => acc.account))
      .catch((err) => {
        console.error("Error getting account from key", err);
        return [];
      });
  }

  static async getNftSerials(network, account, tokenId) {
    let serialData = [];
    let apiErrors = null;

    // Attempt to gather nft data from hedera mirror node
    try {
      const { nfts, status } = await GET(
        HOSTS,
        network,
        `/api/v1/tokens/${tokenId}/nfts?account.id=${account}`
      );

      if (status === 204) return { serialData, apiErrors };

      const serials = nfts?.map((nft) => nft.serial_number);
      serialData = { tokenId, serials };
    } catch (serialError) {
      console.error("Error getting nft balance from Hedera mirror");
      apiErrors = serialError;
      serialData = { tokenId };
    }
    return { serialData, apiErrors };
  }

  static async getAccountTokenBalanceData(
    network,
    account,
    accountBalanceQuery
  ) {
    const balanceData = {};
    const tokensData = {};
    let apiErrors = null;

    // Attempt to gather more data from hedera and kabuto mirror nodes
    try {
      const { tokens, _status } = await GET(
        HOSTS,
        network,
        `/api/v1/tokens?account.id=${account}`
      );
      if (tokens === undefined)
        throw new Error(_status?.messages[0]?.message ?? "Undefined response");

      tokens.forEach(
        ({ token_id, type, symbol }) =>
          (balanceData[token_id.toString()] = { type, symbol })
      );
    } catch (hederaError) {
      console.error(
        "Error getting token balance from Hedera mirror, attempting Kabuto mirror node...",
        hederaError
      );
      try {
        const { data } = await GET(
          KABUTOHOSTS,
          network,
          `/account/${account}/token`
        );
        data.forEach(
          ({ tokenId, type, symbol }) =>
            (balanceData[tokenId.toString()] = { type, symbol })
        );
      } catch (kabutoError) {
        console.error(
          "Error getting token balance from Kabuto mirror node.",
          kabutoError
        );
        apiErrors = { hederaError, kabutoError };
      }
    }

    // To be able to support hip-10 and hip-17 tokens there needs to be some
    // further processing of the token balance

    // Separate fungible and non fungible
    const nftList = [...accountBalanceQuery.tokens].filter(([id, balance]) =>
      balanceData[id.toString()]?.type.includes("NON_FUNGIBLE")
    );
    const tokenList = [...accountBalanceQuery.tokens].filter(
      ([id, balance]) =>
        !balanceData[id.toString()]?.type.includes("NON_FUNGIBLE")
    );

    // If there are hip-17 non fungible tokens add the serial to their id
    // hip-17 tokens will use tokenId@serial_number as their id
    let nftData = [];
    if (nftList?.length) {
      // Get serial data for non fungible tokens
      nftData = await Promise.all(
        nftList.map(
          async ([id, balance]) =>
            await this.getNftSerials(network, account, id.toString())
        )
      );

      const serialErrors = nftData.reduce(
        (a, c) => (c.apiErrors ? a.concat(c.serialData.tokenId) : a),
        []
      );

      // Add non fungible tokens to tokensData including serial
      nftList.forEach(([id, balance]) => {
        const nft = nftData.find(
          ({ serialData }) => serialData.tokenId === id.toString()
        );

        if (serialErrors?.length) {
          // If there were errors getting serial data add the token id and include error
          tokensData[id.toString()] = {
            balance: balance.toString(),
            meta: {
              ...balanceData[id.toString()],
              decimals: accountBalanceQuery.tokenDecimals.get(id.toString()),
            },
          };
          apiErrors = { ...apiErrors, serialErrors };
        } else if (nft?.serialData?.serials?.length) {
          for (const serial of nft.serialData.serials) {
            tokensData[`${id.toString()}@${serial}`] = {
              balance: balance.toString(),
              meta: {
                ...balanceData[id.toString()],
                decimals: accountBalanceQuery.tokenDecimals.get(id.toString()),
              },
            };
          }
        } else {
          // If a token is associated but it's balance is zero
          // it will be present in the balance but won't have serials
          tokensData[id.toString()] = {
            balance: balance.toString(),
            meta: {
              ...balanceData[id.toString()],
              decimals: accountBalanceQuery.tokenDecimals.get(id.toString()),
            },
          };
        }
      });
    }

    // Add fungible tokens to tokensData
    tokenList.forEach(([id, balance]) => {
      tokensData[id.toString()] = {
        balance: balance.toString(),
        meta: {
          ...balanceData[id.toString()],
          decimals: accountBalanceQuery.tokenDecimals.get(id.toString()),
        },
      };
    });

    // Return parsed data and error status
    return { tokensData, apiErrors };
  }

  static async getTokenData(network, tokenId) {
    let apiErrors = null;
    let tokenData = {};
    // Tokens of type NON_FUNGIBLE_UNIQUE will include serial with format: "tokenId@serial"
    const id = tokenId.split("@")[0];

    try {
      // Query every token specifically to grab its totalSupply property to
      // distinguish between pre-HIP-17 & post-HIP-17 created NFTs
      // name and memo are used to display token data
      const { name, memo, total_supply } = await GET(
        HOSTS,
        network,
        `/api/v1/tokens/${id}`
      );
      tokenData = { name, memo, totalSupply: total_supply?.toString() };

      if (!name || !memo || !total_supply) {
        const { data } = await GET(KABUTOHOSTS, network, `/token/${id}`);

        tokenData = Object.keys(tokenData).reduce(
          (a, c) => ({
            [c]: tokenData[c] ? tokenData[c] : data[c]?.toString(),
            ...a,
          }),
          {}
        );
      }

      return { tokenData, apiErrors };
    } catch (hederaError) {
      console.error(
        "Error getting token data from Hedera mirror, attempting Kabuto mirror node...",
        hederaError
      );
      try {
        const {
          data: { name, memo, totalSupply },
        } = await GET(KABUTOHOSTS, network, `/token/${id}`);

        return { tokenData: { name, memo, totalSupply }, apiErrors };
      } catch (kabutoError) {
        console.error(
          "Error getting token data from Kabuto mirror node.",
          kabutoError
        );

        return { tokenData: null, apiErrors: { hederaError, kabutoError } };
      }
    }
  }
  // Use summary.json from status.hedera.com to check status
  static async getHederaNetStatus(activeAccountNetwork) {
    const { status, components } = await fetch(
      "https://status.hedera.com/api/v2/summary.json"
    ).then((x) => x.json());

    const network = components.find(
      (n) =>
        n.name.startsWith(`Hedera ${activeAccountNetwork}`) &&
        n.name.endsWith("Network Uptime")
    );

    const mirrorNode = components.find((m) =>
      m.name.startsWith(
        `Mirror Node REST API ${
          activeAccountNetwork === "Mainnet"
            ? "Public Mainnet"
            : activeAccountNetwork
        }`
      )
    );

    return { status, components: [network, mirrorNode] };
  }

  static async getIpfs(url) {
    const ipfs = await fetch(url).then((x) => x.json());
    return ipfs;
  }
}
