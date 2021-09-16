<template>
  <section class="associate-token">
    <Navbar :show-go-back="true" />

    <transition name="pop-between" mode="out-in">
      <section key="1" class="container" v-if="status === STATUS.TOKENS">
        <section class="no-tokens" v-if="!NFTs.length">
          <span>You don't have any tokens yet!</span>
          Before you can get any tokens, you'll need to approve / associate that
          token with your account. Go back to the main menu and click the
          "Approve token" button to get started.
        </section>
        <section class="tokens" v-if="NFTs.length">
          <section :key="NFT.tokenId" class="token" v-for="NFT of NFTs">
            <!-- Non-Fungible Tokens -->
            <section class="info">
              <!-- Show NFT details (token Id & name) -->
              <figure class="id">{{ NFT.tokenId }}</figure>
              <figure class="name" v-if="NFT.name">{{ NFT.name }}</figure>
              <!-- Show NFT -->
              <figure v-if="NFT.display">
                <!-- if video -->
                <video
                  v-if="NFT.display.type.includes('video')"
                  :src="NFT.display.url"
                  type="video/mp4"
                  controls
                  autoplay
                  loop
                  muted
                />
                <!-- if image -->
                <img v-else :src="NFT.display.url" />
              </figure>
            </section>
            <section class="actions">
              <figure
                class="action"
                @click="removeToken(NFT)"
                v-tooltip.left="'Remove'"
              >
                <i class="fas fa-ban"></i>
              </figure>
              <figure
                class="action"
                @click="transferToken(NFT)"
                v-tooltip.left="'Transfer'"
              >
                <i class="fas fa-exchange-alt"></i>
              </figure>
            </section>
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
import axios from "axios";
const {
  Client,
  TokenInfoQuery,
  AccountBalanceQuery,
  TokenDissociateTransaction
} = require("@hashgraph/sdk");

const STATUS = {
  TOKENS: 0,
  LOADING: 1,
  ERROR: 2
};

export default {
  data() {
    return {
      status: STATUS.TOKENS,
      STATUS,
      selectedToken: null,
      error: null,
      loadingToken: null
    };
  },
  async mounted() {},
  computed: {
    // Filter tokenBalances (currently storing all tokens) into an array of ONLY NFT typed tokens
    // Note: NFTs made before HIP-17 have initialSupply: 1
    //   NFTs made after HIP-17 have an initialSupply: 0 & type: NON_FUNGIBLE
    NFTs() {
      return this.tokenBalances.filter(
        (token) =>
          (token.type === "NON_FUNGIBLE" && token.totalSupply == 0) ||
          (token.type !== "NON_FUNGIBLE" && token.totalSupply == 1)
      );
    }
  },
  methods: {
    async removeToken(token) {
      this.status = STATUS.LOADING;
      const client = this.getClient();
      const tx = await new TokenDissociateTransaction()
        .setAccountId(this.activeAccount.name)
        .setTokenIds([token.tokenId])
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
        query: { tokenId: token.tokenId }
      });
    }
  }
};
</script>

<style lang="scss" scoped>
@import "../styles/variables";

video,
img {
  width: 200px;
  height: 100px;
}

.associate-token {
  padding: 0 26px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: column;
  width: 100%;
  height: 100%;

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

    &.centered {
      justify-content: center;
    }
  }

  .tokens {
    width: 100%;
    max-height: calc(100vh - 120px);
    overflow-y: auto;

    .token {
      width: 100%;
      display: flex;
      align-items: flex-start;
      border-bottom: 1px solid rgba(0, 0, 0, 0.04);
      padding: 10px 5px 10px 0;

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

      .actions {
        flex: 0 0 auto;
        display: flex;

        .action {
          margin: 0 2px;
          border-radius: 4px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1),
            0 3px 8px rgba(0, 0, 0, 0.03);
          color: $darkgrey;
          background: $white;
          height: 30px;
          width: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          transition-property: box-shadow, color, transform;

          i {
            font-size: 14px;
          }

          &:hover {
            box-shadow: 0 6px 13px rgba(0, 0, 0, 0.1),
              0 12px 34px rgba(0, 0, 0, 0.05);
            transform: translateY(-2px);
            color: rgba(0, 0, 0, 0.7);
          }

          &:active {
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12),
              0 3px 5px rgba(0, 0, 0, 0.07);
            transform: translateY(2px);
            color: rgba(0, 0, 0, 0.1);
          }
        }
      }
    }
  }
}
</style>
