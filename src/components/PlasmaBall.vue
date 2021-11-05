<template>
  <div class="wrapper">
    <section class="waiting">
      <section class="graphic">
        <svg width="0" height="0">
          <filter id="gooey-plasma-2">
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="20"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 50 -16"
              result="goo"
            />
          </filter>
        </svg>
        <div class="plasma-2">
          <ul class="gooey-container">
            <li class="bubble"></li>
            <li class="bubble"></li>
            <li class="bubble"></li>
            <li class="bubble"></li>
            <li class="bubble"></li>
            <li class="bubble"></li>
          </ul>
        </div>
      </section>
    </section>
    <section class="api-status">
      <p v-if="apiLoadingStatus.status" class="api-message">
        {{ apiLoadingStatus.status }}
      </p>
      <p v-else-if="apiLoadingStatus.error" class="api-error">
        {{ apiLoadingStatus.error }}
      </p>
      <figure v-else class="text">{{ text }}</figure>
    </section>
    <div v-if="description" class="warning">
      <p class="message">
        Hedera network status is:
        <span class="status">{{ description }}.</span>
      </p>
      <p class="message">You may experience slow transactions or errors.</p>
      <hr v-if="degradedComponents.length" />
      <ul class="components" v-if="degradedComponents.length">
        <li
          class="component"
          :key="component.name"
          v-for="component of degradedComponents"
        >
          <p class="component-info">
            {{ component.name }}:
            <span class="status">{{ component.status }}</span>
          </p>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { mapState } from "vuex";

export default {
  props: ["text"],
  computed: {
    ...mapState(["apiLoadingStatus", "hederaNetworkStatus"]),
    description() {
      return this.hederaNetworkStatus?.description;
    },
    degradedComponents() {
      return this.hederaNetworkStatus?.degradedComponents;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "../styles/variables";
$plasmawidth: 180px;

.wrapper {
  margin-top: auto;
  margin-bottom: auto;
}

.waiting {
  width: $plasmawidth;
  height: $plasmawidth;
  display: block;
  position: relative;
  margin: auto;

  .graphic {
    border-radius: 50%;
    box-shadow: inset 0 0 50px 10px $darkerblue, inset 0 0 10px 0 $darkblue;
    width: $plasmawidth;
    height: $plasmawidth;
    font-size: 12px;

    @keyframes plasma-2 {
      0% {
        transform: scale(1) translate3d(60px, 0, 0);
      }
      50% {
        transform: scale(2) translate3d(-60px, 0, 0);
      }
      100% {
        transform: scale(1) translate3d(60px, 0, 0);
      }
    }
    @keyframes plasma-2-rotate {
      0% {
        transform: translate(-50%, -50%) rotate(0deg);
      }
      100% {
        transform: translate(-50%, -50%) rotate(360deg);
      }
    }

    $color1: $darkerblue;
    $color2: $yellow;
    $color3: $yellow;
    $modifier: 6;

    .plasma-2 {
      backface-visibility: hidden;
      z-index: 2;
      position: relative;
      overflow: hidden;
      border-radius: 50%;
      width: $plasmawidth;
      height: $plasmawidth;
      padding: 0;
      margin-top: -14px;
      transform: scale(0.98);

      .gooey-container {
        overflow: hidden;
        border-radius: 50%;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        filter: url(#gooey-plasma-2);
        width: $plasmawidth + 50px;
        height: $plasmawidth + 50px;
        padding: 0;
        margin: 0;
        box-shadow: 0 0 0 20px $color2 inset;
        animation: plasma-2-rotate 5s linear infinite;

        .bubble {
          display: block;
          position: absolute;
          top: 50%;
          left: 50%;
          width: 100%;
          text-align: right;

          &:before {
            content: "";
            display: inline-block;
            background: $color3;
            width: $plasmawidth / $modifier;
            height: $plasmawidth / $modifier;
            border-radius: 50%;
            transform: scale(1) translate3d(75px, 0, 0);
            box-shadow: 0 0 10px 5px $color1 inset, 0 0 10px 0 $color1 inset;
          }
        }
        @for $i from 1 through 6 {
          .bubble:nth-child(#{$i}) {
            transform: translate(-50%, -50%) rotate(60deg * $i);
          }
          .bubble:nth-child(#{$i}):before {
            animation: plasma-2 5s * ($i / 2) ease 0.5s / $i infinite;
          }
        }
      }
    }
  }
}

.api-status {
  margin-top: 0.8rem;
  margin-bottom: 0.8rem;
  font-size: 0.8rem;
  font-weight: 500;

  .api-error {
    color: $red;
  }

  .api-message {
    color: $yellow;
  }

  .text {
    color: $white;
  }
}

.warning {
  text-align: left;
  margin-top: auto;

  p {
    margin: 0;
  }

  ul {
    margin: 0;
    margin-top: 0.5rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    font-size: 0.7rem;
  }

  li + li {
    margin-top: 0.5rem;
  }

  hr {
    border: 0;
    border-top: solid thin $grey-950;
  }

    .message {
      color: $red;
    }

  .status {
    color: $red;
    font-weight: 600;
  }

  .message,
  .services {
    margin-top: 0.5rem;
  }

  .message + .message {
    margin-top: 4px;
  }
}
</style>
