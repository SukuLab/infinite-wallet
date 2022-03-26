import Vue from "vue";
import { mapState, mapActions } from "vuex";

import VTooltip from "v-tooltip";

import VueRouter from "vue-router";
import { isEqual } from "lodash";
import App from "../popup/App.vue";
import { RouteNames, Routing } from "./Routing";
import store from "../store";
import InternalMessage from "../messages/InternalMessage";
import * as InternalMessageTypes from "../messages/InternalMessageTypes";
import { NETWORKS } from "../models/Networks";
import ApiService from "../services/ApiService";

const { Client, AccountBalanceQuery } = require("@hashgraph/sdk");

Vue.config.productionTip = false;

export let router;

/***
 * Sets up an instance of Vue.
 * This is shared between the popup.js and prompt.js scripts.
 */
export default class VueInitializer {
  constructor(routes, components, middleware = () => {}) {
    this.setupVuePlugins();
    this.registerComponents(components);
    router = this.setupRouting(routes, middleware);

    Vue.mixin({
      data() {
        return {
          RouteNames,
          NETWORKS,
        };
      },
      computed: {
        ...mapState([
          "iv",
          "selectedNetwork",
          "balance",
          "activeAccount",
          "tokenMeta",
        ]),
        hbarBalance() {
          if (!this.balance) return null;
          if (!parseFloat(this.balance.hbars.toTinybars().toString())) {
            return parseFloat(0).toFixed(8);
          } else {
            return parseFloat(
              this.balance.hbars.toTinybars() / 100000000
            ).toFixed(8);
          }
        },
        tokenBalances() {
          if (!this.balance) return null;

          return Object.keys(this.balance.tokens).map(tokenId => {
            // Merging in meta data with balances
            const meta = this.tokenMeta.hasOwnProperty(tokenId)
              ? { ...this.balance.tokens[tokenId].meta, ...this.tokenMeta[tokenId] }
              : this.balance.tokens[tokenId].meta;
            return Object.assign({ id: tokenId, balance: this.balance.tokens[tokenId].balance }, meta);
          });
        },
        hasAccount() {
          return !!this.activeAccount;
        },
      },
      mounted() {
        this.sanitizeVuex();
      },
      methods: {
        async getTokenMeta() {
          store.dispatch(
            "setTokenMeta",
            await InternalMessage.signal(
              InternalMessageTypes.GET_TOKEN_META
            ).send()
          );
        },
        async setTokenMeta(id, query) {
          const meta = {
            name: query.name,
            symbol: query.symbol,
            memo: query.memo,
            decimals: query.decimals,
            type: query.type,
            ipfs: query.ipfs,
            display: query.display,
            totalSupply: query.totalSupply,
            metaDataLoaded: query.metaDataLoaded,
            serialDataLoaded: query.serialDataLoaded,
          };

          // Soft save (prevents having to go back to IPC to update local refs
          const clone = JSON.parse(JSON.stringify(this.tokenMeta));
          clone[id] = meta;
          store.dispatch("setTokenMeta", clone);
          this.$forceUpdate();
          // Hard save
          return await InternalMessage.payload(InternalMessageTypes.SET_TOKEN_META, {
            id,
            meta,
          }).send();
        },
        async checkActiveAccount() {
          if (this.activeAccount) return;
          if (!this.iv) return;

          let account = await InternalMessage.signal(
            InternalMessageTypes.GET_ACTIVE_ACCOUNT
          ).send();
          if (!account) {
            account = this.iv.keychain.accounts[0];
            if (account)
              await InternalMessage.payload(
                InternalMessageTypes.SET_ACTIVE_ACCOUNT,
                account
              ).send();
          }
          if (!account) return;

          store.dispatch("setActiveAccount", account);
        },
        async setSelectedNetwork(network) {
          store.dispatch("setSelectedNetwork", network);
        },
        async regenerateIVData() {
          return store.dispatch(
            "setIV",
            await InternalMessage.signal(InternalMessageTypes.GET_DATA).send()
          );
        },
        sanitizeVuex() {
          // Removes pesky __vue__ exposure from elements.
          const all = document.querySelectorAll("*");
          for (let i = 0, max = all.length; i < max; i++) {
            if (all[i].hasOwnProperty("__vue__")) delete all[i].__vue__;
          }
        },
        getClient() {
          if (!this.activeAccount) return;
          const client = Client[`for${this.activeAccount.network}`]();
          client.setOperatorWith(
            this.activeAccount.name,
            this.activeAccount.publicKey,
            async (buf) => {
              const signature = await InternalMessage.payload(
                InternalMessageTypes.INTERNAL_SIGN,
                { data: buf, account: this.activeAccount }
              ).send();
              return Buffer.from(signature, "hex");
            }
          );

          return client;
        },
        async syncTokenBalanceStorage(balanceQueryTokens) {
          // Get tokenBalance from storage
          const storedTokenBalance = await InternalMessage.signal(InternalMessageTypes.GET_TOKEN_BALANCE).send();
          // Create object from balance query response
          const latestQueryTokens = JSON.parse(balanceQueryTokens.toString());
          // Compare stored balance with balance from last query and update storage if needed
          if (!isEqual(storedTokenBalance, latestQueryTokens)) {
            // This will return true if something was stored
            return await InternalMessage.payload(InternalMessageTypes.SET_TOKEN_BALANCE, JSON.parse(balanceQueryTokens.toString())).send();
          }
          return false;
        },
        async checkHederaNetworkStatus() {
          const { status: { description }, components } = await ApiService.getHederaNetStatus(this.activeAccount.network);

          if (description !== "All Systems Operational") {
            const degradedComponents = components.filter(c => {
              if (c.status !== "operational") return { name: c.name, status: c.status }
            });

            if (description && degradedComponents?.length) {
              store.dispatch("setHederaNetworkStatus", { description, degradedComponents })
            } else {
              store.dispatch("setHederaNetworkStatus", null);
            }
          }
        },
        async getAccountInfo() {
          if (!this.activeAccount) return;

          // Check hedera network status
          this.checkHederaNetworkStatus();

          // Reset api messages when not reloading
          if (this.apiErrors && this.apiLoadingStatus?.includes("Reloading"))
            store.dispatch("setApiLoadingStatus", { status: null, error: null })

          // Get account balance with sdk query
          const client = Client[`for${this.activeAccount.network}`]();
          const accountBalance = await new AccountBalanceQuery()
            .setAccountId(this.activeAccount.name)
            .execute(client)
            .catch((err) => {
              console.error("Error getting account balance", err);
              // Display error
              store.dispatch("setApiLoadingStatus", { status: null, error: "Error getting account balance." })
              return null;
            });

          // If queried account balance has tokens, compare with storage and get basic data from mirror
          const storageUpdated = await this.syncTokenBalanceStorage(accountBalance.tokens);

          // If any token is missing data
          const allDataLoaded = Object.keys(this.tokenMeta)?.length && Object.keys(this.tokenMeta).reduce((r, k) => {
            const { metaDataLoaded, serialDataLoaded } = this.tokenMeta[k]
            return metaDataLoaded && serialDataLoaded && r;
          });

          // If the balance query has length and the stored balance was updated with new data...
          if (accountBalance?.tokens?.size > 0 && (storageUpdated || !allDataLoaded)) {
            // Get extra balance data from mirrors
            const balance = await ApiService.getAccountTokenBalanceData(
              this.activeAccount.network,
              this.activeAccount.name,
              accountBalance
            );

            if (balance.apiErrors) {
              store.dispatch("setApiLoadingStatus", { status: null, error: "Error getting account balance data." })
            } else {
              store.dispatch("setApiLoadingStatus", { status: "Getting data for new tokens.", error: null })
            }

            // Get token meta in storage
            const tokenMeta = await InternalMessage.signal(
              InternalMessageTypes.GET_TOKEN_META
            ).send();

            // Look for new tokens and tokens without metadata
            const newTokensIds = Object.keys(balance.tokensData).filter(k =>
              !(k in tokenMeta) || !this.tokenMeta[k]?.metaDataLoaded || !this.tokenMeta[k]?.serialDataLoaded
            );

            // If there are new tokens, add basic metadata from mirror nodes
            let counter = 0;
            for (const id of newTokensIds) {
              const { tokenData, apiErrors } = await ApiService.getTokenData(
                this.activeAccount.network,
                id
              );

              counter++;

              const tokenLoaded = !apiErrors;
              const serialLoaded = !balance?.apiErrors?.serialErrors?.includes(id);

              if (apiErrors) {
                store.dispatch("setApiLoadingStatus",
                  { status: null, error: `Error loading metadata for ${tokenData?.name ? tokenData.name : id} (${counter} of ${newTokensIds.length})` })
              } else {
                store.dispatch("setApiLoadingStatus",
                  { status: `Loaded metadata for ${tokenData?.name ? tokenData.name : id} (${counter} of ${newTokensIds.length})`, error: null })
              }

              if (!serialLoaded) {
                store.dispatch("setApiLoadingStatus",
                  { status: null, error: `Error loading serial data for ${tokenData?.name ? tokenData.name : id} (${counter} of ${newTokensIds.length})` })
              }

              await this.setTokenMeta(id, { ...balance.tokensData[id].meta, ...tokenData, metaDataLoaded: tokenLoaded, serialDataLoaded: serialLoaded });
            };

            // Update balance in vue store
            store.dispatch("setBalance", { ...accountBalance, tokens: balance.tokensData });
            this.$forceUpdate();
          } else if (accountBalance?.tokens?.size === 0) {
            const tokens = JSON.parse(accountBalance.tokens.toString());
            store.dispatch("setBalance", { ...accountBalance, tokens });
          } else {
            // else reconstruct vue store from storage using accountBalance as account index
            const storedTokenMeta = await InternalMessage.signal(InternalMessageTypes.GET_TOKEN_META).send();
            const storedMetaKeys = Object.keys(storedTokenMeta);

            let tokens = {};

            [...accountBalance.tokens].forEach(([id, balance]) => {
              const tokenInstances = storedMetaKeys.filter((key) => key.includes(id.toString()));
              tokenInstances.forEach((id) => tokens[id] = { balance: balance.toString(), meta: storedTokenMeta[id] })
            });

            store.dispatch("setBalance", { ...accountBalance, tokens });
          }

          store.dispatch("setApiLoadingStatus", { status: null, error: null })
        },
        formatNumber(num) {
          if (!num) return 0;

          let precision = num.toString().split(".")[1];
          precision = precision ? precision.length : 0;

          const [whole, decimal] = num.toString().split(".");
          const formatted = whole
            .toString()
            .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          if (!decimal || parseInt(decimal) === 0) return formatted;
          return `${formatted}.${decimal}`;
        },
      },
    });

    this.setupVue(router);

    return router;
  }

  setupVuePlugins() {
    Vue.use(VueRouter);
    Vue.use(VTooltip, {
      defaultOffset: 5,
      defaultDelay: 0,
      defaultContainer: "#app"
    });
  }

  registerComponents(components) {
    components.map((component) => {
      Vue.component(component.tag, component.vue);
    });
  }

  setupRouting(routes, middleware) {
    const router = new VueRouter({
      routes,
      // mode: 'history',
      linkExactActiveClass: "active"
    });

    router.beforeEach((to, from, next) => {
      return middleware(to, next);
    });

    return router;
  }

  setupVue(router) {
    const app = new Vue({
      router,
      store,
      render: (h) => h(App)
    });
    app.$mount("#app");
  }
}
