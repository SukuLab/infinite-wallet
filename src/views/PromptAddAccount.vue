<template>
  <section class="prompt-login">
    <section>
      <img alt="logo" src="../assets/infinite-logo-by-suku.svg" />
      <figure class="account-details">
        Add account request
      </figure>
    </section>
    <section class="details">
      <figure class="pre">
        An application is requesting that you add an account to your wallet.
      </figure>
      <figure class="domain">{{ prompt.data.domain }}</figure>
      <figure class="account">
        <b>{{ prompt.data.name }}</b> for <b>{{ prompt.data.network }}</b>
      </figure>
      <!--<figure class="public-key">{{prompt.data.publicKey}}</figure>-->
      <figure class="disclaimer">
        Applications that add accounts to your wallet could have stored the
        private key somewhere before they gave it to you. Be cautious and do not
        put larges amounts of valuable tokens on application linked accounts.
      </figure>
    </section>
    <section class="actions">
      <Swiper v-on:approved="approve" v-on:denied="deny" />
    </section>
  </section>
</template>

<script>
import PromptService from "../services/PromptService";
import { mapState } from "vuex";

export default {
  async mounted() {},
  data() {
    return {
      selectedAccount: null
    };
  },
  computed: {
    ...mapState(["prompt"])
  },
  methods: {
    approve() {
      this.prompt.responder(true);
      PromptService.close();
    },
    deny() {
      this.prompt.responder(false);
      PromptService.close();
    }
  }
};
</script>

<style lang="scss" scoped>
@import "../styles/variables";

.prompt-login {
  padding: 60px 26px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: column;
  width: 100%;
  height: 100vh;

  img {
    width: 15rem;
    height: 5rem;
  }

  .account-details {
    font-size: 1rem;
    color: $yellow;
    margin-top: 10px;
    b {
      color: $blue;
    }
  }

  .details {
    color: $black;
    font-size: 18px;
    font-weight: 300;

    label {
      font-size: 0.75rem;
      margin-bottom: 5px;
      color: $white;
    }

    .pre {
      font-size: 14px;
      color: $lightergrey;
    }

    .domain {
      font-size: 20px;
      color: $white;
      margin-top: 10px;
      margin-bottom: 30px;
      font-weight: bold;
    }

    .account {
      font-size: 13px;
      margin-top: 10px;

      b {
        color: $white;
      }
    }

    .metadata {
      font-size: 9px;
    }

    .public-key {
      font-size: 9px;
      margin-top: 10px;
    }

    .disclaimer {
      font-size: 11px;
      color: $lightergrey;
      padding: 0 15px;
      margin-top: 20px;
    }
  }

  .actions {
    width: 100%;
  }
}
</style>
