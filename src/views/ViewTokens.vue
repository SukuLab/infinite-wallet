<template>
  <section class="associate-token">
    <Navbar :show-go-back="true" class="navbar" />

    <transition name="pop-between" mode="out-in">
      <section key="1" class="container" v-if="status === STATUS.TOKENS">
        <section
          class="no-tokens"
          v-if="
            (!tokens || !tokens.length) && (!unknownType || !unknownType.length)
          "
        >
          <span>You don't have any tokens yet!</span>
          Before you can get any tokens, you'll need to approve / associate that
          token with your account. Go back to the main menu and click the
          "Approve token" button to get started.
        </section>
        <section
          class="tokens unknown"
          v-if="unknownType && unknownType.length"
        >
          <header>
            <h3>Tokens of unknown Type</h3>
            <p>
              These tokens have been found in your wallet but don't have their
              metadata loaded. You can click on the information button for each
              token to query data using hbars or try to get metadata from mirror
              nodes:
            </p>
            <button class="retry-button" @click="retryMirrorNodes">
              Retry loading metadata
            </button>
          </header>
          <section :key="token.id" class="token" v-for="token in unknownType">
            <TokenTile
              :token="token"
              :loadingData="loadingToken === token.id"
              @ipfsLoading="addIpfsLoading"
              @ipfsLoaded="storeIpfsMeta"
              @loadTokenInfo="loadTokenInfo(token.id)"
              @removeToken="removeToken(token)"
              @transferToken="transferToken(token)"
            />
          </section>
          <hr />
        </section>
        <section
          class="tokens unknown"
          v-if="missingSerialData && missingSerialData.length"
        >
          <header>
            <h3>Tokens with missing serial data</h3>
            <p>
              These tokens have been found in your wallet but don't have their
              serial data loaded. You can retry to get their data from mirror
              nodes:
            </p>
            <button class="retry-button" @click="retryMirrorNodes">
              Retry loading token serial data
            </button>
          </header>
          <section
            :key="token.id"
            class="token"
            v-for="token in missingSerialData"
          >
            <TokenTile
              :token="token"
              :loadingData="loadingToken === token.id"
              @ipfsLoading="addIpfsLoading"
              @ipfsLoaded="storeIpfsMeta"
              @loadTokenInfo="loadTokenInfo(token.id)"
              @removeToken="removeToken(token)"
              @transferToken="transferToken(token)"
            />
          </section>
          <hr />
        </section>
        <section class="tokens" v-if="tokens && tokens.length">
          <header v-if="unknownType && unknownType.length">
            <h3>Tokens:</h3>
          </header>
          <section :key="token.id" class="token" v-for="token in tokens">
            <TokenTile
              :token="token"
              :loadingData="loadingToken === token.id"
              @ipfsLoading="addIpfsLoading"
              @ipfsLoaded="storeIpfsMeta"
              @loadTokenInfo="loadTokenInfo(token.id)"
              @removeToken="removeToken(token)"
              @transferToken="transferToken(token)"
            />
          </section>
        </section>
      </section>

      <section
        key="2"
        class="container centered"
        v-if="status === STATUS.LOADING"
      >
        <PlasmaBall text="Reading the daily gossip." />
      </section>

      <section
        key="3"
        class="container centered"
        v-if="status === STATUS.ERROR"
      >
        <section class="transfer-panel red">
          <figure class="check-circle">
            <i class="fas fa-times"></i>
          </figure>
          <figure class="title">Oh no!</figure>
          <figure class="text">
            {{ error }}
          </figure>
          <button @click="status = STATUS.TOKENS">Try again</button>
        </section>
      </section>
    </transition>
  </section>
</template>

<script>
const {
  TokenInfoQuery,
  TokenDissociateTransaction,
} = require("@hashgraph/sdk");

import store from "../store";

const STATUS = {
  TOKENS: 0,
  LOADING: 1,
  ERROR: 2,
};

export default {
  data() {
    return {
      status: STATUS.TOKENS,
      STATUS,
      selectedToken: null,
      error: null,
      loadingToken: null,
      loadingIpfs: [],
      loadedTokens: [],
    };
  },
  async mounted() {},
  computed: {
    // Filter tokens without metadata
    unknownType() {
      return this.tokenBalances?.filter((token) => {
        return (
          token?.type === undefined &&
          token?.totalSupply === undefined &&
          !token?.metaDataLoaded
        );
      });
    },
    // Filter tokens without serial data
    missingSerialData() {
      return this.tokenBalances?.filter((token) => {
        return (
          token?.type !== undefined &&
          token?.type.includes("NON_FUNGIBLE") &&
          !token?.serialDataLoaded
        );
      });
    },
    // Filter tokenBalances (currently storing all tokens) into an array of ONLY NON-NFT (aka fungible tokens) typed tokens
    FTs() {
      return this.tokenBalances?.filter((token) => {
        return (
          token?.type !== undefined &&
          !token.type.includes("NON_FUNGIBLE") &&
          token.totalSupply != 1
        );
      });
    },
    // Filter tokenBalances (currently storing all tokens) into an array of ONLY NFT typed tokens
    // Note: NFTs made before HIP-17 have initialSupply: 1 & type: FUNGIBLE
    //   NFTs made after HIP-17 have an initialSupply: 0 & type: NON_FUNGIBLE
    NFTs() {
      return this.tokenBalances?.filter(
        (token) =>
          (token?.type !== undefined &&
            token.type.includes("NON_FUNGIBLE") &&
            token.serialDataLoaded) ||
          (token?.type !== undefined &&
            !token.type.includes("NON_FUNGIBLE") &&
            token.totalSupply == 1)
      );
    },
    tokens() {
      const route = this.$router.history.current.name;
      return route === "nft-tokens" ? this.NFTs : this.FTs;
    },
  },
  methods: {
    async removeToken(token) {
      this.status = STATUS.LOADING;
      const client = this.getClient();
      const tx = await new TokenDissociateTransaction()
        .setAccountId(this.activeAccount.name)
        .setTokenIds([token.id])
        .execute(client)
        .catch((err) => {
          console.error("Token dissociate error", err);
          this.status = STATUS.ERROR;
          this.error = err;
          return null;
        });

      if (tx) {
        if (
          await tx.getReceipt(client).catch((err) => {
            console.error("Error sending", err);
            this.status = STATUS.ERROR;
            this.error = err;
            return null;
          })
        ) {
          await new Promise((r) => setTimeout(r, 1000));
          await this.getAccountInfo();
          this.status = STATUS.TOKENS;
        }
      }
    },
    transferToken(token) {
      this.$router.push({
        path: "/transfer",
        query: { tokenId: token.id },
      });
    },
    async loadTokenInfo(tokenId) {
      this.loadingToken = tokenId;
      const client = this.getClient();
      let query = await new TokenInfoQuery()
        .setTokenId(tokenId)
        .execute(client)
        .catch((err) => {
          console.error("Token get info error", err);
          this.status = STATUS.ERROR;
          this.error = err;
          this.loadingToken = null;
          return null;
        });

      if (query) {
        const { totalSupply, tokenType, tokenMemo, symbol, name } = query;

        await this.setTokenMeta(tokenId, {
          ...this.tokenMeta[tokenId],
          totalSupply:
            totalSupply?.toString() ?? this.tokenMeta[tokenId]?.totalSupply,
          name: name ? name : this.tokenMeta[tokenId]?.name,
          type: tokenType
            ? tokenType?.toString()
            : this.tokenMeta[tokenId]?.type,
          symbol: symbol ? symbol : this.tokenMeta[tokenId]?.symbol,
          memo: tokenMemo ? tokenMemo : this.tokenMeta[tokenId]?.memo,
          metaDataLoaded: true,
        });

        setTimeout(() => {
          this.getAccountInfo();
          this.loadingToken = null;
        }, 1000);

        this.$forceUpdate();
      }
    },
    addIpfsLoading(tokenId) {
      this.loadingIpfs.push(tokenId);
    },
    async storeIpfsMeta({ tokenId, ipfsData }) {
      // if loaded are less than total append to loaded list
      if (this.loadedTokens?.length < this.loadingIpfs?.length) {
        this.loadedTokens.push({ tokenId, ipfsData });
      }

      // if loaded is equal to total store using setTokenMeta
      if (this.loadedTokens?.length === this.loadingIpfs?.length) {
        for (const loadedToken of this.loadedTokens) {
          const ipfsDataName =
            loadedToken.ipfsData?.metadata?.name ??
            loadedToken.ipfsData?.sku?.name;

          await this.setTokenMeta(loadedToken.tokenId, {
            ...this.tokenMeta[loadedToken.tokenId],
            ipfs: { ...loadedToken.ipfsData },
            name: ipfsDataName ?? this.tokenMeta[loadedToken.tokenId].name,
          });
        }
      }
    },
    async retryMirrorNodes() {
      await store.dispatch("setApiLoadingStatus", {
        status: "Reloading token metadata from mirror nodes.",
        error: null,
      });
      this.$router.push("/main");
    },
  },
};
</script>

<style lang="scss" scoped>
@import "../styles/variables";

.associate-token {
  padding: 0;
  padding-left: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: column;
  width: 100%;
  height: 100%;

  .navbar {
    padding-right: 24px;
  }

  .no-tokens {
    display: flex;
    width: 100%;
    height: 100%;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    padding: 0 20px;

    span {
      font-size: 18px;
      display: block;
      margin-bottom: 15px;
    }
  }

  .transfer-panel {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;

    .check-circle {
      border: 10px solid $green;
      border-radius: 50%;
      font-size: 64px;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 120px;
      width: 120px;
      color: $green;
    }

    .title {
      font-size: 24px;
      font-weight: bold;
      color: $green;
    }

    .text {
      font-size: 13px;
      color: $grey;
      margin-top: 15px;
    }

    &.red {
      .check-circle {
        color: $red;
        border: 10px solid $red;
      }

      .title {
        color: $red;
      }
    }

    button {
      margin-top: 30px;
      height: 40px;
      font-size: 14px;
      width: auto;
    }
  }

  .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow-y: auto;

    &.centered {
      justify-content: center;
    }
  }

  .tokens {
    width: 100%;

    header {
      h3 {
        color: $grey-800;
        font-size: 1.25rem;
        margin-top: 0;
      }
    }

    .token + .token {
      margin-top: 20px;
    }

    .token {
      width: 100%;
      display: flex;
      align-items: flex-start;
      border-bottom: 1px solid rgba(0, 0, 0, 0.04);
      padding: 10px 5px 10px 0;
      padding: 0;
      padding-right: 18px;

      .info {
        flex: 1;
        text-align: left;
        padding: 0 10px;

        &.no-pad {
          padding-left: 0;
        }

        .id {
          font-size: 11px;
        }

        .name {
          font-size: 13px;
          font-weight: bold;
          color: $yellow;
        }

        .balance {
          font-size: 16px;
          font-weight: bold;
        }
      }
    }
  }

  .tokens + .tokens {
    margin-top: 8px;
  }

  .tokens.unknown {
    header {
      padding: 26px;

      p {
        color: $grey-700;
      }

      .retry-button {
        font-size: 1rem;
        margin-top: 8px;
        margin-bottom: 8px;
        height: 3rem;
      }
    }

    hr {
      border: 0;
      border-top: solid thin $grey-100;
      margin: 16px 18px 16px 0;
    }
  }
}
</style>
