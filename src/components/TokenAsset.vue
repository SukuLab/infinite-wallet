<template>
  <figure>
    <figure v-if="asset">
      <!-- if video -->
      <video
        v-if="assetData.type.includes('video')"
        :src="assetData.url"
        type="video/mp4"
        controls
        autoplay
        loop
        muted
        style="width: 100%"
      />
      <!-- if image -->
      <img v-else :src="assetData.url" style="width: 100%" />
    </figure>
  </figure>
</template>

<script>
export default {
  props: ["ipfs"],
  async mounted() {},
  computed: {
    asset() {
      if (this.ipfs?.image) return this.ipfs;

      return this.ipfs?.sku ?? this.ipfs?.metadata;
    },
    assetData() {
      if (this.asset === undefined) return { type: "", url: "" };

      const { nftPublicAssets } = this.asset;

      if (nftPublicAssets && nftPublicAssets.length) {
        const { type, url } = nftPublicAssets[0];
        return { type, url };
      }

      const videoTypes = ["mov", "mp4", "mpg", "webm"];

      if (this.asset.image) {
        const isVideo = videoTypes.find((t) => this.asset?.image.endsWith(t));
        return { type: isVideo ? "video" : "image", url: this.asset.image };
      }

      return { type: "", url: "" };
    },
  },
};
</script>
