<template>
  <article class="tile">
    <header>
      <h3>{{ token.name }}</h3>
      <div class="info">
        <h4>
          <span>{{ id }}</span>
          <span v-if="serial">#{{ serial }}</span>
        </h4>
        <p>Balance: {{ token.balance }}</p>
      </div>
    </header>
    <section class="asset">
      <TokenAsset :ipfs="token.ipfs" />
    </section>
    <section class="actions">
      <button
        class="action"
        @click="loadTokenInfo"
        v-tooltip.left="'Load token info <br />(costs $0.0001)'"
        v-if="!token.metaDataLoaded"
      >
        <i v-if="loadingData" class="fas fa-spinner fa-spin"></i>
        <i v-else class="fas fa-info-circle"></i>
      </button>
      <button class="action" @click="removeToken" v-tooltip.left="'Remove'">
        <i class="fas fa-ban"></i>
      </button>
      <button class="action" @click="transferToken" v-tooltip.left="'Transfer'" v-if="token.serialDataLoaded && token.balance">
        <i class="fas fa-exchange-alt"></i>
      </button>
    </section>
  </article>
</template>

<script>
import ApiService from "../services/ApiService";

export default {
  props: ["token", "loadingData"],
  computed: {
    id() {
      if (this.token.id.includes("@")) {
        return this.token.id.split("@")[0];
      } else {
        return this.token.id;
      }
    },
    serial() {
      if (this.token.id.includes("@")) {
        return this.token.id.split("@")[1];
      } else {
        return null;
      }
    },
  },
  async mounted() {
    // Check stored token meta to see if ipfs call is needed
    const { symbol, memo } = this.tokenMeta[this.token.id];

    const { ipfs } = this.tokenMeta[this.token.id];

    if (ipfs === undefined) {
      let url;
      if (symbol?.includes("ipfs")) {
        url = symbol;
      } else if (memo?.includes("ipfs")) {
        url = memo;
      }

      if (url) {
        this.$emit("ipfsLoading", this.token.id);
        const ipfsData = await ApiService.getIpfs(url);
        this.$emit("ipfsLoaded", { tokenId: this.token.id, ipfsData });
      }
    }
  },
  methods: {
    loadTokenInfo() {
      this.$emit("loadTokenInfo");
    },
    removeToken() {
      this.$emit("removeToken");
    },
    transferToken() {
      this.$emit("transferToken");
    },
  },
};
</script>

<style lang="scss" scoped>
@import "../styles/variables";

.tile {
  width: 100%;
  background-color: $grey-50;
  padding: 20px;
  text-align: left;
  box-shadow: 0 1px 3px rgb(0, 0, 0), 0 3px 8px rgb(0, 0, 0);

  > * + * {
    margin-top: 16px;
  }

  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 400;
    margin-bottom: 16px;
  }

  .info {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    color: $grey-400;

    h4 {
      margin: 0;
      font-size: 18px;
      font-weight: 500;

      span + span {
        margin-left: 0.25em;
        color: $grey-300;
        font-style: italic;
      }
    }

    p {
      margin: 0;
      font-size: 16px;
      font-weight: 500;
    }
  }
}

.actions {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  padding-top: 4px;

  .action {
    height: 30px;
    width: 30px;
    border-radius: 8px;
    padding: 18px;
  }

  .action + .action {
    margin-left: 12px;
  }
}
</style>
